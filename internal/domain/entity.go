package domain

import (
	"time"

	"github.com/google/uuid"
)

// Tenant はマルチテナンシーの基本単位を表す。
// ユーザーのサインアップ時に自動生成される。
type Tenant struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	CompanyName string    `json:"company_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// User は認証プリンシパルを表す。
// TenantMembership を介してテナントと関連付けられる。
type User struct {
	UserID       uuid.UUID `json:"user_id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TenantMembership はユーザーとテナントの関係を保持する。
// テナント内でのユーザーのロールも含む。
// MVP: 1 ユーザー = 1 テナント = 1 ロール（RBC-002）。
type TenantMembership struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Category は経費カテゴリのマスターレコードを表す。
// tenant_id が NULL の場合はグローバル（システム定義）カテゴリを意味する。
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

// ExpenseReport はドメインの中心エンティティであり集約ルート。
// 状態遷移とビジネスルールはここで管理される。
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

// ExpenseItem は ExpenseReport に属する個々の経費明細行を表す。
// RLS の効率化のため tenant_id を冗長保持する。
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

// Attachment は ExpenseItem に添付された領収書のファイルメタデータを保持する。
// 実ファイルは S3 に保存される。
// RLS および S3 パス構築のため tenant_id を冗長保持する。
// 作成後は不変（deleted_at を除く）。
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

// RefreshToken はトークンローテーション用のハッシュ化されたリフレッシュトークンを保存する。
type RefreshToken struct {
	JTI       uuid.UUID `json:"jti"`
	UserID    uuid.UUID `json:"user_id"`
	TokenHash string    `json:"token_hash"`
	IsRevoked bool      `json:"is_revoked"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// PasswordResetToken はハッシュ化されたワンタイムのパスワードリセットトークンを保存する。
type PasswordResetToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	CreatedAt time.Time  `json:"created_at"`
}
