package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ReportListParams holds optional filter/pagination parameters for listing reports.
type ReportListParams struct {
	// UserID filters to reports owned by this user (nil = no filter).
	UserID *uuid.UUID
	// Status filters by report status (nil = no filter).
	Status *ReportStatus
	// From filters by period_start >= From (nil = no filter).
	From *time.Time
	// To filters by period_end <= To (nil = no filter).
	To *time.Time
	// SubmitterID filters by the report creator's user ID (nil = no filter).
	SubmitterID *uuid.UUID
	// Cursor is the created_at value from the last item (exclusive upper bound).
	Cursor *time.Time
	// Limit is the maximum number of items to return.
	Limit int
}

// WorkflowListParams holds pagination parameters for workflow list endpoints.
type WorkflowListParams struct {
	// ApplicantName filters by applicant name (partial match, nil = no filter).
	ApplicantName *string
	// Cursor is the submitted_at / approved_at value from the last item.
	Cursor *time.Time
	// Limit is the maximum number of items to return.
	Limit int
}

// TenantRepository provides persistence operations for Tenant entities.
type TenantRepository interface {
	// Create persists a new tenant and returns the created record.
	Create(ctx context.Context, companyName string) (*Tenant, error)
	// GetByID retrieves a tenant by its primary key.
	GetByID(ctx context.Context, tenantID uuid.UUID) (*Tenant, error)
}

// UserRepository provides persistence operations for User entities.
type UserRepository interface {
	// Create persists a new user and returns the created record.
	Create(ctx context.Context, email, name, passwordHash string) (*User, error)
	// GetByID retrieves a user by primary key.
	GetByID(ctx context.Context, userID uuid.UUID) (*User, error)
	// GetByEmail retrieves a user by email address.
	GetByEmail(ctx context.Context, email string) (*User, error)
	// UpdatePassword updates the password hash for a user.
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
}

// MembershipRepository provides persistence operations for TenantMembership entities.
type MembershipRepository interface {
	// Create persists a new tenant membership.
	Create(ctx context.Context, tenantID, userID uuid.UUID, role Role) (*TenantMembership, error)
	// GetByUserID retrieves the membership for a given user (MVP: 1 user = 1 tenant).
	GetByUserID(ctx context.Context, userID uuid.UUID) (*TenantMembership, error)
	// ListByTenantID retrieves all memberships within a tenant.
	ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]TenantMembership, error)
	// HasApprover returns true when the tenant has at least one Approver.
	HasApprover(ctx context.Context, tenantID uuid.UUID) (bool, error)
}

// CategoryRepository provides read access to expense category master data.
type CategoryRepository interface {
	// ListActive returns active categories visible within a tenant
	// (global categories + tenant-specific categories).
	ListActive(ctx context.Context, tenantID uuid.UUID) ([]Category, error)
	// GetByID retrieves a category by primary key, scoped to the given tenant
	// (matches tenant-specific categories or global categories where tenant_id IS NULL).
	GetByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*Category, error)
}

// ReportRepository provides persistence operations for ExpenseReport entities.
type ReportRepository interface {
	// Create persists a new expense report.
	Create(ctx context.Context, tenantID, userID uuid.UUID, title string, periodStart, periodEnd time.Time, referenceReportID *uuid.UUID) (*ExpenseReport, error)
	// GetByID retrieves a report scoped to a tenant.
	GetByID(ctx context.Context, tenantID, reportID uuid.UUID) (*ExpenseReport, error)
	// List retrieves reports within a tenant matching the given parameters.
	List(ctx context.Context, tenantID uuid.UUID, params ReportListParams) ([]ExpenseReport, error)
	// Update applies a partial update to a report (title, period fields).
	// Implements optimistic locking via updatedAt; returns ErrConflict on version mismatch.
	Update(ctx context.Context, report *ExpenseReport) error
	// UpdateStatus transitions a report to a new status.
	// Implements optimistic locking via updatedAt; returns ErrConflict on version mismatch.
	UpdateStatus(ctx context.Context, report *ExpenseReport) error
	// SoftDelete marks a report (and its items/attachments) as deleted.
	SoftDelete(ctx context.Context, tenantID, reportID uuid.UUID) error
	// CountByStatus returns per-status counts for reports matching the filter.
	CountByStatus(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID) (map[ReportStatus]int, error)
	// MonthlySummary returns the aggregated total_amount per calendar month
	// for the last numMonths months within the tenant.
	MonthlySummary(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, numMonths int) ([]MonthlySummary, error)
	// ListPending returns submitted reports within a tenant.
	ListPending(ctx context.Context, tenantID uuid.UUID, params WorkflowListParams) ([]ExpenseReport, error)
	// ListPayable returns approved reports within a tenant.
	ListPayable(ctx context.Context, tenantID uuid.UUID, params WorkflowListParams) ([]ExpenseReport, error)
}

// ItemRepository provides persistence operations for ExpenseItem entities.
type ItemRepository interface {
	// Create persists a new expense item and recalculates the report total.
	Create(ctx context.Context, tenantID, reportID uuid.UUID, expenseDate time.Time, amount int, categoryID uuid.UUID, description string) (*ExpenseItem, error)
	// GetByID retrieves an item scoped to a tenant and report.
	GetByID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) (*ExpenseItem, error)
	// ListByReportID retrieves all active items for a report.
	ListByReportID(ctx context.Context, tenantID, reportID uuid.UUID) ([]ExpenseItem, error)
	// Update replaces mutable item fields. Implements optimistic locking via updatedAt.
	Update(ctx context.Context, item *ExpenseItem) error
	// SoftDelete marks an item (and its attachments) as deleted and recalculates the report total.
	SoftDelete(ctx context.Context, tenantID, reportID, itemID uuid.UUID) error
}

// AttachmentRepository provides persistence operations for Attachment entities.
type AttachmentRepository interface {
	// Create persists attachment metadata.
	Create(ctx context.Context, tenantID, reportID, itemID uuid.UUID, fileName string, fileSize int, mimeType MimeType, s3Key string) (*Attachment, error)
	// GetByID retrieves an attachment scoped to a tenant, report, and item.
	GetByID(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) (*Attachment, error)
	// ListByItemID retrieves all active attachments for an item.
	ListByItemID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) ([]Attachment, error)
	// SoftDelete marks an attachment as deleted.
	SoftDelete(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) error
}

// RefreshTokenRepository provides persistence operations for RefreshToken entities.
type RefreshTokenRepository interface {
	// Create persists a new refresh token.
	Create(ctx context.Context, jti, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error)
	// GetByJTI retrieves a refresh token by its JWT ID.
	GetByJTI(ctx context.Context, jti uuid.UUID) (*RefreshToken, error)
	// Revoke marks a token as revoked.
	Revoke(ctx context.Context, jti uuid.UUID) error
}

// PasswordResetTokenRepository provides persistence operations for PasswordResetToken entities.
type PasswordResetTokenRepository interface {
	// Create persists a new password reset token.
	Create(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*PasswordResetToken, error)
	// GetByTokenHash retrieves a valid (unused, non-expired) token by its hash.
	GetByTokenHash(ctx context.Context, tokenHash string) (*PasswordResetToken, error)
	// MarkUsed records the token as used (used_at = now).
	MarkUsed(ctx context.Context, id uuid.UUID) error
}
