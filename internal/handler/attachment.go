package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// AttachmentHandler は添付ファイルエンドポイントの handler です。
type AttachmentHandler struct {
	svc service.AttachmentService
}

// NewAttachmentHandler は AttachmentHandler を生成して返します。
func NewAttachmentHandler(svc service.AttachmentService) *AttachmentHandler {
	return &AttachmentHandler{svc: svc}
}

// UploadAttachment は POST /api/reports/{id}/items/{itemId}/attachments を処理します。
func (h *AttachmentHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListAttachments は GET /api/reports/{id}/items/{itemId}/attachments を処理します。
func (h *AttachmentHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetAttachmentDownload は GET /api/reports/{id}/items/{itemId}/attachments/{attId} を処理します。
func (h *AttachmentHandler) GetAttachmentDownload(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteAttachment は DELETE /api/reports/{id}/items/{itemId}/attachments/{attId} を処理します。
func (h *AttachmentHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
