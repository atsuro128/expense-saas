// Package postgres provides sqlcgen-backed implementations of the domain repository interfaces.
// All public functions in this package enforce tenant_id isolation via the generated queries.
package postgres

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

// --- pgtype helpers ---

func toPgtypeUUID(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func fromPgtypeUUID(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	id := uuid.UUID(p.Bytes)
	return &id
}

func fromPgtypeTimestamptz(p pgtype.Timestamptz) *time.Time {
	if !p.Valid {
		return nil
	}
	return &p.Time
}

func fromPgtypeText(p pgtype.Text) *string {
	if !p.Valid {
		return nil
	}
	return &p.String
}

func fromPgtypeDate(p pgtype.Date) time.Time {
	if !p.Valid {
		return time.Time{}
	}
	return time.Date(int(p.Time.Year()), p.Time.Month(), int(p.Time.Day()), 0, 0, 0, 0, time.UTC)
}

func toPgtypeDate(t time.Time) pgtype.Date {
	return pgtype.Date{
		Time:  t,
		Valid: true,
	}
}

// --- Tenant ---

func tenantFromRow(r sqlcgen.Tenant) *domain.Tenant {
	return &domain.Tenant{
		TenantID:    r.TenantID,
		CompanyName: r.CompanyName,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// --- User ---

func userFromRow(r sqlcgen.User) *domain.User {
	return &domain.User{
		UserID:       r.UserID,
		Email:        r.Email,
		Name:         r.Name,
		PasswordHash: r.PasswordHash,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

// --- TenantMembership ---

func membershipFromRow(r sqlcgen.TenantMembership) *domain.TenantMembership {
	return &domain.TenantMembership{
		TenantID:  r.TenantID,
		UserID:    r.UserID,
		Role:      domain.Role(r.Role),
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

// --- Category ---

func categoryFromRow(r sqlcgen.Category) *domain.Category {
	return &domain.Category{
		CategoryID: r.CategoryID,
		TenantID:   fromPgtypeUUID(r.TenantID),
		Code:       r.Code,
		NameJa:     r.NameJa,
		SortOrder:  int(r.SortOrder),
		IsActive:   r.IsActive,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
}

// --- ExpenseReport ---

func reportFromRow(r sqlcgen.ExpenseReport) *domain.ExpenseReport {
	return &domain.ExpenseReport{
		ReportID:          r.ReportID,
		TenantID:          r.TenantID,
		UserID:            r.UserID,
		Title:             r.Title,
		PeriodStart:       fromPgtypeDate(r.PeriodStart),
		PeriodEnd:         fromPgtypeDate(r.PeriodEnd),
		Status:            domain.ReportStatus(r.Status),
		TotalAmount:       int(r.TotalAmount),
		ReferenceReportID: fromPgtypeUUID(r.ReferenceReportID),
		SubmittedBy:       fromPgtypeUUID(r.SubmittedBy),
		SubmittedAt:       fromPgtypeTimestamptz(r.SubmittedAt),
		ApprovedBy:        fromPgtypeUUID(r.ApprovedBy),
		ApprovedAt:        fromPgtypeTimestamptz(r.ApprovedAt),
		ApprovalComment:   fromPgtypeText(r.ApprovalComment),
		RejectedBy:        fromPgtypeUUID(r.RejectedBy),
		RejectedAt:        fromPgtypeTimestamptz(r.RejectedAt),
		RejectionReason:   fromPgtypeText(r.RejectionReason),
		PaidBy:            fromPgtypeUUID(r.PaidBy),
		PaidAt:            fromPgtypeTimestamptz(r.PaidAt),
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
		DeletedAt:         fromPgtypeTimestamptz(r.DeletedAt),
	}
}

// --- ExpenseItem ---

func itemFromRow(r sqlcgen.ExpenseItem) *domain.ExpenseItem {
	return &domain.ExpenseItem{
		ItemID:      r.ItemID,
		ReportID:    r.ReportID,
		TenantID:    r.TenantID,
		ExpenseDate: fromPgtypeDate(r.ExpenseDate),
		Amount:      int(r.Amount),
		CategoryID:  r.CategoryID,
		Description: r.Description,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
		DeletedAt:   fromPgtypeTimestamptz(r.DeletedAt),
	}
}

// --- Attachment ---

func attachmentFromRow(r sqlcgen.Attachment) *domain.Attachment {
	return &domain.Attachment{
		AttachmentID: r.AttachmentID,
		ItemID:       r.ItemID,
		ReportID:     r.ReportID,
		TenantID:     r.TenantID,
		FileName:     r.FileName,
		FileSize:     int(r.FileSize),
		MimeType:     domain.MimeType(r.MimeType),
		S3Key:        r.S3Key,
		CreatedAt:    r.CreatedAt,
		DeletedAt:    fromPgtypeTimestamptz(r.DeletedAt),
	}
}

// --- RefreshToken ---

func refreshTokenFromRow(r sqlcgen.RefreshToken) *domain.RefreshToken {
	return &domain.RefreshToken{
		JTI:       r.Jti,
		UserID:    r.UserID,
		TokenHash: r.TokenHash,
		IsRevoked: r.IsRevoked,
		ExpiresAt: r.ExpiresAt,
		CreatedAt: r.CreatedAt,
	}
}

// --- PasswordResetToken ---

func passwordResetTokenFromRow(r sqlcgen.PasswordResetToken) *domain.PasswordResetToken {
	return &domain.PasswordResetToken{
		ID:        r.ID,
		UserID:    r.UserID,
		TokenHash: r.TokenHash,
		ExpiresAt: r.ExpiresAt,
		UsedAt:    fromPgtypeTimestamptz(r.UsedAt),
		CreatedAt: r.CreatedAt,
	}
}
