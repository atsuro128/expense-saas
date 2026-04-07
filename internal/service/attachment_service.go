package service

import (
	"context"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type attachmentService struct {
	reportRepo     domain.ReportRepository
	itemRepo       domain.ItemRepository
	attachmentRepo domain.AttachmentRepository
	authorizer     Authorizer
}

// NewAttachmentService は AttachmentService を生成して返す。
func NewAttachmentService(
	reportRepo domain.ReportRepository,
	itemRepo domain.ItemRepository,
	attachmentRepo domain.AttachmentRepository,
	authorizer Authorizer,
) AttachmentService {
	return &attachmentService{
		reportRepo:     reportRepo,
		itemRepo:       itemRepo,
		attachmentRepo: attachmentRepo,
		authorizer:     authorizer,
	}
}

func (s *attachmentService) UploadAttachment(_ context.Context, _ domain.Actor, _, _ uuid.UUID, _ FileUpload) (*domain.AttachmentDTO, error) {
	return nil, ErrNotImplemented
}

func (s *attachmentService) ListAttachments(_ context.Context, _ domain.Actor, _, _ uuid.UUID) ([]domain.AttachmentDTO, error) {
	return nil, ErrNotImplemented
}

func (s *attachmentService) GetAttachmentDownload(_ context.Context, _ domain.Actor, _, _, _ uuid.UUID) (*domain.AttachmentDownload, error) {
	return nil, ErrNotImplemented
}

func (s *attachmentService) DeleteAttachment(_ context.Context, _ domain.Actor, _, _, _ uuid.UUID) error {
	return ErrNotImplemented
}
