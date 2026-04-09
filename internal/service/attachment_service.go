package service

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// attachmentMaxSize は添付ファイルの最大サイズ（5MB）。
const attachmentMaxSize = 5 * 1024 * 1024 // 5,242,880 バイト

// attachmentDownloadExpiry は署名付きダウンロード URL の有効期限（15 分）。
const attachmentDownloadExpiry = 15 * time.Minute

type attachmentService struct {
	reportRepo     domain.ReportRepository
	itemRepo       domain.ItemRepository
	attachmentRepo domain.AttachmentRepository
	authorizer     Authorizer
	storage        StorageClient
}

// NewAttachmentService は AttachmentService を生成して返す。
func NewAttachmentService(
	reportRepo domain.ReportRepository,
	itemRepo domain.ItemRepository,
	attachmentRepo domain.AttachmentRepository,
	authorizer Authorizer,
	storage StorageClient,
) AttachmentService {
	return &attachmentService{
		reportRepo:     reportRepo,
		itemRepo:       itemRepo,
		attachmentRepo: attachmentRepo,
		authorizer:     authorizer,
		storage:        storage,
	}
}

// UploadAttachment はファイルを S3 にアップロードし、添付ファイルのメタデータを DB に保存する。
//
// 処理手順:
//  1. レポート取得（存在しない場合は ErrResourceNotFound）
//  2. 所有権チェック（CanModifyReport）
//  3. 状態チェック（draft のみ）
//  4. 明細所属確認（item が URL の report_id に属するか）
//  5. ファイルバリデーション（サイズ、MIME タイプ、マジックバイト）
//  6. S3 アップロード
//  7. DB メタデータ保存
func (s *attachmentService) UploadAttachment(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, upload FileUpload) (*domain.AttachmentDTO, error) {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 所有権チェック（RBC-010: 所有者のみ添付可能）。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return nil, err
	}

	// 編集可能状態チェック（draft のみ）。
	if err := report.CanEdit(); err != nil {
		return nil, err
	}

	// 明細の所属確認（item が report に属するか）。
	if _, err := s.itemRepo.GetByID(ctx, actor.TenantID, reportID, itemID); err != nil {
		return nil, err
	}

	// ファイルサイズチェック（ATT-003: 5MB 以下）。
	if upload.FileSize > attachmentMaxSize {
		return nil, domain.ErrFileTooLarge
	}

	// MIME タイプと Content-Type の整合性チェック（ATT-002, ATT-013）。
	if !upload.MimeType.IsValid() {
		return nil, domain.ErrInvalidFileType
	}

	// マジックバイト検証: ファイル内容から実際の MIME タイプを判定して宣言と一致するか確認する。
	detected := detectMimeType(upload.Content)
	if detected != upload.MimeType {
		return nil, domain.ErrInvalidFileType
	}

	// S3 キーを生成する（ATT-014: {tenant_id}/{report_id}/{attachment_id}）。
	attachmentID := uuid.New()
	s3Key := fmt.Sprintf("%s/%s/%s", actor.TenantID.String(), reportID.String(), attachmentID.String())

	// S3 にアップロードする。
	if err := s.storage.Upload(ctx, s3Key, bytes.NewReader(upload.Content), string(upload.MimeType)); err != nil {
		return nil, fmt.Errorf("attachmentService.UploadAttachment: upload to storage: %w", err)
	}

	// DB にメタデータを保存する。
	att, err := s.attachmentRepo.Create(ctx, attachmentID, actor.TenantID, reportID, itemID, upload.FileName, upload.FileSize, upload.MimeType, s3Key)
	if err != nil {
		// S3 アップロード済みだが DB 保存失敗した場合はエラーを返す（バッチ削除で孤立オブジェクトを回収する）。
		return nil, fmt.Errorf("attachmentService.UploadAttachment: save metadata: %w", err)
	}

	return &domain.AttachmentDTO{
		ID:        att.AttachmentID,
		ItemID:    att.ItemID,
		FileName:  att.FileName,
		FileSize:  att.FileSize,
		MimeType:  att.MimeType,
		CreatedAt: att.CreatedAt,
	}, nil
}

// ListAttachments は経費項目に紐づく有効な添付ファイルを全件取得する。
//
// 処理手順:
//  1. レポート取得
//  2. 閲覧権限チェック（CanViewReport）
//  3. 明細所属確認
//  4. 添付一覧取得
func (s *attachmentService) ListAttachments(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) ([]domain.AttachmentDTO, error) {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 閲覧権限チェック（ATT-021: レポート閲覧権限に準ずる）。
	if err := s.authorizer.CanViewReport(actor, report); err != nil {
		return nil, err
	}

	// 明細の所属確認。
	if _, err := s.itemRepo.GetByID(ctx, actor.TenantID, reportID, itemID); err != nil {
		return nil, err
	}

	// 添付ファイル一覧を取得する。
	attachments, err := s.attachmentRepo.ListByItemID(ctx, actor.TenantID, reportID, itemID)
	if err != nil {
		return nil, fmt.Errorf("attachmentService.ListAttachments: %w", err)
	}

	dtos := make([]domain.AttachmentDTO, len(attachments))
	for i, att := range attachments {
		dtos[i] = domain.AttachmentDTO{
			ID:        att.AttachmentID,
			ItemID:    att.ItemID,
			FileName:  att.FileName,
			FileSize:  att.FileSize,
			MimeType:  att.MimeType,
			CreatedAt: att.CreatedAt,
		}
	}
	return dtos, nil
}

// GetAttachmentDownload は添付ファイルのダウンロード用署名付き URL を返す。
//
// 処理手順:
//  1. レポート取得
//  2. 閲覧権限チェック（CanViewReport）
//  3. 添付メタデータ取得
//  4. 署名付き URL 生成（有効期限 15 分）
func (s *attachmentService) GetAttachmentDownload(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) (*domain.AttachmentDownload, error) {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 閲覧権限チェック（認可確認後に URL を発行する）。
	if err := s.authorizer.CanViewReport(actor, report); err != nil {
		return nil, err
	}

	// 添付メタデータを取得する（テナント・レポート・明細スコープ）。
	att, err := s.attachmentRepo.GetByID(ctx, actor.TenantID, reportID, itemID, attachmentID)
	if err != nil {
		return nil, err
	}

	// 署名付き URL を生成する（ATT-012: 有効期限 15 分）。
	downloadURL, expiresAt, err := s.storage.PresignGetObject(ctx, att.S3Key, att.FileName, string(att.MimeType), attachmentDownloadExpiry)
	if err != nil {
		return nil, fmt.Errorf("attachmentService.GetAttachmentDownload: presign: %w", err)
	}

	return &domain.AttachmentDownload{
		DownloadURL: downloadURL,
		FileName:    att.FileName,
		MimeType:    att.MimeType,
		FileSize:    att.FileSize,
		ExpiresAt:   expiresAt,
	}, nil
}

// DeleteAttachment は添付ファイルを論理削除する（S3 物理削除はバッチ処理で行う）。
//
// 処理手順:
//  1. レポート取得
//  2. 所有権チェック（CanModifyReport）
//  3. 状態チェック（draft のみ）
//  4. 添付メタデータ取得（存在確認）
//  5. 論理削除
func (s *attachmentService) DeleteAttachment(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) error {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return err
	}

	// 所有権チェック（RBC-010: 所有者のみ削除可能）。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return err
	}

	// 編集可能状態チェック（draft のみ）。
	if err := report.CanEdit(); err != nil {
		return err
	}

	// 添付ファイルの存在確認。
	if _, err := s.attachmentRepo.GetByID(ctx, actor.TenantID, reportID, itemID, attachmentID); err != nil {
		return err
	}

	// 論理削除する（S3 物理削除はバッチ処理で行う）。
	return s.attachmentRepo.SoftDelete(ctx, actor.TenantID, reportID, itemID, attachmentID)
}

// detectMimeType はファイルの先頭バイトから実際の MIME タイプを判定する。
// Go 標準ライブラリの http.DetectContentType() を使用する（ATT-013）。
// 判定できなかった場合は空の MimeType を返す。
func detectMimeType(content []byte) domain.MimeType {
	if len(content) == 0 {
		return ""
	}
	detected := http.DetectContentType(content)
	// DetectContentType は "image/jpeg", "image/png", "application/pdf" を返す可能性がある。
	// ただし、PDF は "application/octet-stream" として検出されることがある。
	// PDF の場合はマジックバイトを直接確認する。
	switch {
	case isJPEG(content):
		return domain.MimeTypeImageJpeg
	case isPNG(content):
		return domain.MimeTypeImagePng
	case isPDF(content):
		return domain.MimeTypeApplicationPDF
	}
	// http.DetectContentType のフォールバック。
	switch detected {
	case "image/jpeg":
		return domain.MimeTypeImageJpeg
	case "image/png":
		return domain.MimeTypeImagePng
	}
	return domain.MimeType(detected)
}

// isJPEG は JPEG マジックバイト（FF D8 FF）を確認する。
func isJPEG(b []byte) bool {
	return len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF
}

// isPNG は PNG マジックバイト（89 50 4E 47 0D 0A 1A 0A）を確認する。
func isPNG(b []byte) bool {
	return len(b) >= 8 &&
		b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 &&
		b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A
}

// isPDF は PDF マジックバイト（%PDF = 25 50 44 46）を確認する。
func isPDF(b []byte) bool {
	return len(b) >= 4 && b[0] == 0x25 && b[1] == 0x50 && b[2] == 0x44 && b[3] == 0x46
}
