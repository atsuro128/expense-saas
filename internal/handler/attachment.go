package handler

import (
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// attachmentMaxBytes は Go HTTP サーバーで受け付けるリクエストボディの最大サイズ（6MB）。
// multipart/form-data のヘッダー・境界文字列のオーバーヘッドを考慮して 5MB より 1MB 大きく設定する（files.md 7.3）。
const attachmentMaxBytes = 6 * 1024 * 1024

// attachmentFileSizeLimit はアプリケーション層でチェックするファイルサイズ上限（5MB）（ATT-003）。
const attachmentFileSizeLimit = 5 * 1024 * 1024

// attachmentResponse は POST/GET 添付レスポンスを openapi.yaml の Attachment 契約に合わせる構造体。
// download_url は含まない（一覧取得では不要）。
type attachmentResponse struct {
	ID        uuid.UUID        `json:"id"`
	ItemID    uuid.UUID        `json:"item_id"`
	FileName  string           `json:"file_name"`
	FileSize  int              `json:"file_size"`
	MimeType  domain.MimeType  `json:"mime_type"`
	CreatedAt time.Time        `json:"created_at"`
}

// attachmentDownloadResponse は GET /attachments/{attId} のレスポンス構造体。
// openapi.yaml の AttachmentDownload スキーマに準拠する。
type attachmentDownloadResponse struct {
	DownloadURL string          `json:"download_url"`
	FileName    string          `json:"file_name"`
	MimeType    domain.MimeType `json:"mime_type"`
	FileSize    int             `json:"file_size"`
	ExpiresAt   time.Time       `json:"expires_at"`
}

// toAttachmentResponse は AttachmentDTO を API 契約準拠のレスポンスに変換する。
func toAttachmentResponse(dto *domain.AttachmentDTO) attachmentResponse {
	return attachmentResponse{
		ID:        dto.ID,
		ItemID:    dto.ItemID,
		FileName:  dto.FileName,
		FileSize:  dto.FileSize,
		MimeType:  dto.MimeType,
		CreatedAt: dto.CreatedAt,
	}
}

// toAttachmentDownloadResponse は AttachmentDownload を API 契約準拠のレスポンスに変換する。
func toAttachmentDownloadResponse(dl *domain.AttachmentDownload) attachmentDownloadResponse {
	return attachmentDownloadResponse{
		DownloadURL: dl.DownloadURL,
		FileName:    dl.FileName,
		MimeType:    dl.MimeType,
		FileSize:    dl.FileSize,
		ExpiresAt:   dl.ExpiresAt,
	}
}

// AttachmentHandler は添付ファイルエンドポイントの handler です。
type AttachmentHandler struct {
	svc service.AttachmentService
}

// NewAttachmentHandler は AttachmentHandler を生成して返します。
func NewAttachmentHandler(svc service.AttachmentService) *AttachmentHandler {
	return &AttachmentHandler{svc: svc}
}

// UploadAttachment は POST /api/reports/{id}/items/{itemId}/attachments を処理します。
// multipart/form-data でファイルを受け取り、バリデーション後に S3 へアップロードします。
func (h *AttachmentHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	// リクエストボディを 6MB に制限する（files.md 7.3）。
	r.Body = http.MaxBytesReader(w, r.Body, attachmentMaxBytes)

	// multipart/form-data をパースする。
	if err := r.ParseMultipartForm(attachmentMaxBytes); err != nil {
		// MaxBytesReader によるサイズ超過の場合も含む。
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "failed to parse multipart form")
		return
	}

	// file パートを取得する（ATT-009: file パートがない場合は 400）。
	file, header, err := r.FormFile("file")
	if err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "file part is required")
		return
	}
	defer func() { _ = file.Close() }()

	// ファイルの Content-Type を取得する（ATT-010: Content-Type なしは 422）。
	partContentType := header.Header.Get("Content-Type")
	if partContentType == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_FILE_TYPE", "Content-Type is required for the file part")
		return
	}

	// Content-Type が許可リストに含まれるか確認する（ATT-002）。
	mimeType := domain.MimeType(partContentType)
	if !mimeType.IsValid() {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_FILE_TYPE", "unsupported file type")
		return
	}

	// ファイル内容を読み込む（ファイルサイズチェックを含む）。
	content, err := io.ReadAll(io.LimitReader(file, attachmentFileSizeLimit+1))
	if err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "failed to read file")
		return
	}

	// ファイルサイズチェック（ATT-003: 5MB 超過は 413）。
	fileSize := len(content)
	if fileSize > attachmentFileSizeLimit {
		middleware.RespondError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "file size exceeds the 5MB limit")
		return
	}

	upload := service.FileUpload{
		FileName: header.Filename,
		FileSize: fileSize,
		MimeType: mimeType,
		Content:  content,
	}

	dto, err := h.svc.UploadAttachment(r.Context(), actor, reportID, itemID, upload)
	if err != nil {
		respondAttachmentError(w, err)
		return
	}

	resp := toAttachmentResponse(dto)
	middleware.RespondJSON(w, http.StatusCreated, map[string]any{"data": resp})
}

// ListAttachments は GET /api/reports/{id}/items/{itemId}/attachments を処理します。
func (h *AttachmentHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	dtos, err := h.svc.ListAttachments(r.Context(), actor, reportID, itemID)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	// 空配列を返す（null ではなく []）。
	responses := make([]attachmentResponse, len(dtos))
	for i := range dtos {
		responses[i] = toAttachmentResponse(&dtos[i])
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": responses})
}

// GetAttachmentDownload は GET /api/reports/{id}/items/{itemId}/attachments/{attId} を処理します。
func (h *AttachmentHandler) GetAttachmentDownload(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	attID, err := uuid.Parse(chi.URLParam(r, "attId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid attachment id")
		return
	}

	dl, err := h.svc.GetAttachmentDownload(r.Context(), actor, reportID, itemID, attID)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	resp := toAttachmentDownloadResponse(dl)
	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": resp})
}

// DeleteAttachment は DELETE /api/reports/{id}/items/{itemId}/attachments/{attId} を処理します。
func (h *AttachmentHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	attID, err := uuid.Parse(chi.URLParam(r, "attId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid attachment id")
		return
	}

	if err := h.svc.DeleteAttachment(r.Context(), actor, reportID, itemID, attID); err != nil {
		respondDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// respondAttachmentError は添付ファイル固有のドメインエラーを HTTP レスポンスにマッピングする。
// 添付ファイル固有のエラー（FileTooLarge, InvalidFileType）を追加でハンドリングし、
// 残りは respondDomainError に委譲する。
func respondAttachmentError(w http.ResponseWriter, err error) {
	switch err {
	case domain.ErrFileTooLarge:
		middleware.RespondError(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", err.Error())
	case domain.ErrInvalidFileType:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_FILE_TYPE", err.Error())
	default:
		respondDomainError(w, err)
	}
}
