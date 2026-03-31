package domain

import (
	"time"

	"github.com/google/uuid"
)

// Tenant represents the basic unit of multi-tenancy.
// Created automatically when a user signs up.
type Tenant struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	CompanyName string    `json:"company_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// User is the authentication principal.
// Related to tenants via TenantMembership.
type User struct {
	UserID       uuid.UUID `json:"user_id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TenantMembership holds the relation between a user and a tenant,
// including the user's role within that tenant.
// MVP: 1 user = 1 tenant = 1 role (RBC-002).
type TenantMembership struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Category represents an expense category master record.
// tenant_id IS NULL means a global (system-defined) category.
type Category struct {
	CategoryID uuid.UUID  `json:"category_id"`
	TenantID   *uuid.UUID `json:"tenant_id"`
	Code       string     `json:"code"`
	NameJa     string     `json:"name_ja"`
	SortOrder  int        `json:"sort_order"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ExpenseReport is the central domain entity and aggregate root.
// State transitions and business rules are enforced here.
type ExpenseReport struct {
	ReportID          uuid.UUID    `json:"report_id"`
	TenantID          uuid.UUID    `json:"tenant_id"`
	UserID            uuid.UUID    `json:"user_id"`
	Title             string       `json:"title"`
	PeriodStart       time.Time    `json:"period_start"`
	PeriodEnd         time.Time    `json:"period_end"`
	Status            ReportStatus `json:"status"`
	TotalAmount       int          `json:"total_amount"`
	ReferenceReportID *uuid.UUID   `json:"reference_report_id"`
	SubmittedBy       *uuid.UUID   `json:"submitted_by"`
	SubmittedAt       *time.Time   `json:"submitted_at"`
	ApprovedBy        *uuid.UUID   `json:"approved_by"`
	ApprovedAt        *time.Time   `json:"approved_at"`
	ApprovalComment   *string      `json:"approval_comment"`
	RejectedBy        *uuid.UUID   `json:"rejected_by"`
	RejectedAt        *time.Time   `json:"rejected_at"`
	RejectionReason   *string      `json:"rejection_reason"`
	PaidBy            *uuid.UUID   `json:"paid_by"`
	PaidAt            *time.Time   `json:"paid_at"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
	DeletedAt         *time.Time   `json:"deleted_at"`
}

// ExpenseItem is an individual expense line belonging to an ExpenseReport.
// tenant_id is held redundantly for RLS efficiency.
type ExpenseItem struct {
	ItemID      uuid.UUID  `json:"item_id"`
	ReportID    uuid.UUID  `json:"report_id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	ExpenseDate time.Time  `json:"expense_date"`
	Amount      int        `json:"amount"`
	CategoryID  uuid.UUID  `json:"category_id"`
	Description string     `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at"`
}

// Attachment holds file metadata for a receipt attached to an ExpenseItem.
// The actual file is stored in S3.
// tenant_id is held redundantly for RLS + S3 path construction.
// Immutable after creation (except deleted_at).
type Attachment struct {
	AttachmentID uuid.UUID  `json:"attachment_id"`
	ItemID       uuid.UUID  `json:"item_id"`
	ReportID     uuid.UUID  `json:"report_id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	FileName     string     `json:"file_name"`
	FileSize     int        `json:"file_size"`
	MimeType     MimeType   `json:"mime_type"`
	S3Key        string     `json:"s3_key"`
	CreatedAt    time.Time  `json:"created_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
}

// RefreshToken stores a hashed refresh token for token rotation.
type RefreshToken struct {
	JTI       uuid.UUID `json:"jti"`
	UserID    uuid.UUID `json:"user_id"`
	TokenHash string    `json:"token_hash"`
	IsRevoked bool      `json:"is_revoked"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// PasswordResetToken stores a hashed one-time password reset token.
type PasswordResetToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	CreatedAt time.Time  `json:"created_at"`
}
