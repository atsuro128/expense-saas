package domain

import (
	"time"

	"github.com/google/uuid"
)

// UserSummary はネストされたレスポンスで使用する最小限のユーザー表現。
type UserSummary struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// UserProfile は GET /api/auth/me が返す認証済みユーザーの完全なプロフィール情報。
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

// AuthResult はサインアップ・ログイン・トークンリフレッシュ成功時に返す。
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

// CategoryDTO は API レスポンスで使用するカテゴリの表現。
type CategoryDTO struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	NameJa    string    `json:"name_ja"`
	SortOrder int       `json:"sort_order"`
}

// TenantInfoDTO は GET /api/tenant が返すテナント情報の表現。
type TenantInfoDTO struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// AttachmentDTO は API レスポンスで使用する添付ファイルのメタデータ表現。
type AttachmentDTO struct {
	ID        uuid.UUID `json:"id"`
	ItemID    uuid.UUID `json:"item_id"`
	FileName  string    `json:"file_name"`
	FileSize  int       `json:"file_size"`
	MimeType  MimeType  `json:"mime_type"`
	CreatedAt time.Time `json:"created_at"`
}

// AttachmentDownload は GET /api/reports/{id}/items/{itemId}/attachments/{attId}
// が返す署名済みダウンロード URL を含む。
type AttachmentDownload struct {
	DownloadURL string    `json:"download_url"`
	FileName    string    `json:"file_name"`
	MimeType    MimeType  `json:"mime_type"`
	FileSize    int       `json:"file_size"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// ExpenseItemDTO は API レスポンスで使用する経費明細の表現。
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

// ExpenseReportSummary は一覧表示用の軽量なレポート表現。
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
	// Submitter は listAllReports レスポンスで設定される。
	Submitter *UserSummary `json:"submitter,omitempty"`
}

// ExpenseReportDetail は明細を含む完全なレポートの表現。
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

// PendingReport は承認者の承認待ちリストの各項目。
type PendingReport struct {
	ID          uuid.UUID   `json:"id"`
	Title       string      `json:"title"`
	TotalAmount int         `json:"total_amount"`
	SubmittedAt time.Time   `json:"submitted_at"`
	Submitter   UserSummary `json:"submitter"`
	IsOwnReport bool        `json:"is_own_report"`
}

// PayableReport は経理チームの支払い待ちリストの各項目。
type PayableReport struct {
	ID          uuid.UUID   `json:"id"`
	Title       string      `json:"title"`
	TotalAmount int         `json:"total_amount"`
	ApprovedAt  time.Time   `json:"approved_at"`
	Submitter   UserSummary `json:"submitter"`
	IsOwnReport bool        `json:"is_own_report"`
}

// MonthlySummary は1か月分の支出集計データを保持する。
type MonthlySummary struct {
	YearMonth   string `json:"year_month"`
	TotalAmount int    `json:"total_amount"`
}

// RecentReport はダッシュボードで使用するコンパクトなレポートレコード。
type RecentReport struct {
	ID          uuid.UUID    `json:"id"`
	Title       string       `json:"title"`
	PeriodStart time.Time    `json:"period_start"`
	PeriodEnd   time.Time    `json:"period_end"`
	TotalAmount int          `json:"total_amount"`
	Status      ReportStatus `json:"status"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// DashboardData はロールごとに異なるダッシュボードのペイロード。
// 各フィールドはアクターのロールに応じて設定される。
type DashboardData struct {
	// メンバー・承認者・経理 共通
	MyDraftCount     *int            `json:"my_draft_count,omitempty"`
	MySubmittedCount *int            `json:"my_submitted_count,omitempty"`
	MyRejectedCount  *int            `json:"my_rejected_count,omitempty"`
	RecentReports    []RecentReport  `json:"recent_reports,omitempty"`
	// 承認者専用
	PendingApprovalCount *int             `json:"pending_approval_count,omitempty"`
	// 経理専用
	PendingPaymentCount *int `json:"pending_payment_count,omitempty"`
	// 承認者・経理・管理者 共通
	MonthlySummary []MonthlySummary `json:"monthly_summary,omitempty"`
	// 管理者専用
	TenantDraftCount     *int `json:"tenant_draft_count,omitempty"`
	TenantSubmittedCount *int `json:"tenant_submitted_count,omitempty"`
	TenantApprovedCount  *int `json:"tenant_approved_count,omitempty"`
	TenantRejectedCount  *int `json:"tenant_rejected_count,omitempty"`
	TenantPaidCount      *int `json:"tenant_paid_count,omitempty"`
	TenantMemberCount    *int `json:"tenant_member_count,omitempty"`
}

// Pagination は一覧レスポンスに含まれるオフセットベースのページネーションメタデータ。
type Pagination struct {
	CurrentPage int `json:"current_page"`
	PerPage     int `json:"per_page"`
	TotalCount  int `json:"total_count"`
	TotalPages  int `json:"total_pages"`
}
