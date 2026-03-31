package domain

import (
	"time"

	"github.com/google/uuid"
)

// UserSummary is a minimal user representation used in nested responses.
type UserSummary struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// UserProfile is the full authenticated user profile returned by GET /api/auth/me.
type UserProfile struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Email  string    `json:"email"`
	Role   Role      `json:"role"`
	Tenant struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	} `json:"tenant"`
}

// AuthResult is returned after successful signup, login, or token refresh.
type AuthResult struct {
	User struct {
		ID    uuid.UUID `json:"id"`
		Name  string    `json:"name"`
		Email string    `json:"email"`
		Role  Role      `json:"role"`
	} `json:"user"`
	Tenant struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	} `json:"tenant"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// CategoryDTO is the category representation used in API responses.
type CategoryDTO struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	NameJa    string    `json:"name_ja"`
	SortOrder int       `json:"sort_order"`
}

// TenantInfoDTO is the tenant representation returned by GET /api/tenant.
type TenantInfoDTO struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// AttachmentDTO is the attachment metadata representation used in API responses.
type AttachmentDTO struct {
	ID        uuid.UUID `json:"id"`
	ItemID    uuid.UUID `json:"item_id"`
	FileName  string    `json:"file_name"`
	FileSize  int       `json:"file_size"`
	MimeType  MimeType  `json:"mime_type"`
	CreatedAt time.Time `json:"created_at"`
}

// AttachmentDownload contains the signed URL returned by
// GET /api/reports/{id}/items/{itemId}/attachments/{attId}.
type AttachmentDownload struct {
	DownloadURL string    `json:"download_url"`
	FileName    string    `json:"file_name"`
	MimeType    MimeType  `json:"mime_type"`
	FileSize    int       `json:"file_size"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// ExpenseItemDTO is the item representation used in API responses.
type ExpenseItemDTO struct {
	ID          uuid.UUID       `json:"id"`
	ReportID    uuid.UUID       `json:"report_id"`
	ExpenseDate time.Time       `json:"expense_date"`
	Amount      int             `json:"amount"`
	Category    CategoryDTO     `json:"category"`
	Description string          `json:"description"`
	Attachments []AttachmentDTO `json:"attachments"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// ExpenseReportSummary is the lightweight list item representation.
type ExpenseReportSummary struct {
	ID          uuid.UUID    `json:"id"`
	Title       string       `json:"title"`
	PeriodStart time.Time    `json:"period_start"`
	PeriodEnd   time.Time    `json:"period_end"`
	Status      ReportStatus `json:"status"`
	TotalAmount int          `json:"total_amount"`
	SubmittedAt *time.Time   `json:"submitted_at,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	// Submitter is populated in the listAllReports response.
	Submitter *UserSummary `json:"submitter,omitempty"`
}

// ExpenseReportDetail is the full report representation including nested items.
type ExpenseReportDetail struct {
	ID                uuid.UUID        `json:"id"`
	Title             string           `json:"title"`
	PeriodStart       time.Time        `json:"period_start"`
	PeriodEnd         time.Time        `json:"period_end"`
	Status            ReportStatus     `json:"status"`
	TotalAmount       int              `json:"total_amount"`
	Submitter         UserSummary      `json:"submitter"`
	ReferenceReportID *uuid.UUID       `json:"reference_report_id,omitempty"`
	SubmittedAt       *time.Time       `json:"submitted_at,omitempty"`
	SubmittedBy       *UserSummary     `json:"submitted_by,omitempty"`
	ApprovedAt        *time.Time       `json:"approved_at,omitempty"`
	ApprovedBy        *UserSummary     `json:"approved_by,omitempty"`
	ApprovalComment   *string          `json:"approval_comment,omitempty"`
	RejectedAt        *time.Time       `json:"rejected_at,omitempty"`
	RejectedBy        *UserSummary     `json:"rejected_by,omitempty"`
	RejectionReason   *string          `json:"rejection_reason,omitempty"`
	PaidAt            *time.Time       `json:"paid_at,omitempty"`
	PaidBy            *UserSummary     `json:"paid_by,omitempty"`
	Items             []ExpenseItemDTO `json:"items"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// PendingReport is the item in the Approver's pending list.
type PendingReport struct {
	ID          uuid.UUID   `json:"id"`
	Title       string      `json:"title"`
	TotalAmount int         `json:"total_amount"`
	SubmittedAt time.Time   `json:"submitted_at"`
	Submitter   UserSummary `json:"submitter"`
	IsOwnReport bool        `json:"is_own_report"`
}

// PayableReport is the item in the Accounting team's payable list.
type PayableReport struct {
	ID          uuid.UUID   `json:"id"`
	Title       string      `json:"title"`
	TotalAmount int         `json:"total_amount"`
	ApprovedAt  time.Time   `json:"approved_at"`
	Submitter   UserSummary `json:"submitter"`
	IsOwnReport bool        `json:"is_own_report"`
}

// MonthlySummary holds aggregate spend data for a single calendar month.
type MonthlySummary struct {
	YearMonth   string `json:"year_month"`
	TotalAmount int    `json:"total_amount"`
}

// RecentReport is a compact report record used on the dashboard.
type RecentReport struct {
	ID          uuid.UUID    `json:"id"`
	Title       string       `json:"title"`
	PeriodStart time.Time    `json:"period_start"`
	PeriodEnd   time.Time    `json:"period_end"`
	TotalAmount int          `json:"total_amount"`
	Status      ReportStatus `json:"status"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// DashboardData is the role-specific dashboard payload.
// Fields are populated based on the actor's role.
type DashboardData struct {
	// Member, Approver, Accounting
	MyDraftCount     *int            `json:"my_draft_count,omitempty"`
	MySubmittedCount *int            `json:"my_submitted_count,omitempty"`
	MyRejectedCount  *int            `json:"my_rejected_count,omitempty"`
	RecentReports    []RecentReport  `json:"recent_reports,omitempty"`
	// Approver only
	PendingApprovalCount *int             `json:"pending_approval_count,omitempty"`
	// Accounting only
	PendingPaymentCount *int `json:"pending_payment_count,omitempty"`
	// Approver, Accounting, Admin
	MonthlySummary []MonthlySummary `json:"monthly_summary,omitempty"`
	// Admin only
	TenantDraftCount     *int `json:"tenant_draft_count,omitempty"`
	TenantSubmittedCount *int `json:"tenant_submitted_count,omitempty"`
	TenantApprovedCount  *int `json:"tenant_approved_count,omitempty"`
	TenantRejectedCount  *int `json:"tenant_rejected_count,omitempty"`
	TenantPaidCount      *int `json:"tenant_paid_count,omitempty"`
	TenantMemberCount    *int `json:"tenant_member_count,omitempty"`
}

// Pagination is the cursor-based pagination metadata included in list responses.
type Pagination struct {
	NextCursor *string `json:"next_cursor"`
	HasMore    bool    `json:"has_more"`
}
