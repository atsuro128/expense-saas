package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type attachmentRepo struct {
	pool *pgxpool.Pool
}

// NewAttachmentRepo は PostgreSQL をバックエンドとする AttachmentRepository を生成して返す。
func NewAttachmentRepo(pool *pgxpool.Pool) domain.AttachmentRepository {
	return &attachmentRepo{pool: pool}
}

func (r *attachmentRepo) Create(
	ctx context.Context,
	attachmentID, tenantID, reportID, itemID uuid.UUID,
	fileName string,
	fileSize int,
	mimeType domain.MimeType,
	s3Key string,
) (*domain.Attachment, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateAttachment(ctx, sqlcgen.CreateAttachmentParams{
		AttachmentID: attachmentID,
		ItemID:       itemID,
		ReportID:     reportID,
		TenantID:     tenantID,
		FileName:     fileName,
		FileSize:     int32(fileSize),
		MimeType:     string(mimeType),
		S3Key:        s3Key,
	})
	if err != nil {
		return nil, fmt.Errorf("attachmentRepo.Create: %w", err)
	}
	return attachmentFromRow(row), nil
}

func (r *attachmentRepo) GetByID(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) (*domain.Attachment, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetAttachmentByID(ctx, sqlcgen.GetAttachmentByIDParams{
		TenantID:     tenantID,
		ReportID:     reportID,
		ItemID:       itemID,
		AttachmentID: attachmentID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("attachmentRepo.GetByID: %w", err)
	}
	return attachmentFromRow(row), nil
}

func (r *attachmentRepo) ListByItemID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) ([]domain.Attachment, error) {
	q := queries(ctx, r.pool)
	rows, err := q.ListAttachmentsByItemID(ctx, sqlcgen.ListAttachmentsByItemIDParams{
		TenantID: tenantID,
		ReportID: reportID,
		ItemID:   itemID,
	})
	if err != nil {
		return nil, fmt.Errorf("attachmentRepo.ListByItemID: %w", err)
	}
	result := make([]domain.Attachment, len(rows))
	for i, row := range rows {
		att := attachmentFromRow(row)
		result[i] = *att
	}
	return result, nil
}

func (r *attachmentRepo) SoftDelete(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) error {
	q := queries(ctx, r.pool)
	if err := q.SoftDeleteAttachment(ctx, sqlcgen.SoftDeleteAttachmentParams{
		TenantID:     tenantID,
		ReportID:     reportID,
		ItemID:       itemID,
		AttachmentID: attachmentID,
	}); err != nil {
		return fmt.Errorf("attachmentRepo.SoftDelete: %w", err)
	}
	return nil
}
