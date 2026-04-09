package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ReportListParams はレポート一覧取得のオプションフィルタ・ページネーションパラメータを保持する。
type ReportListParams struct {
	// UserID は指定ユーザーが所有するレポートに絞り込む（nil = フィルタなし）。
	UserID *uuid.UUID
	// Status はレポートステータスで絞り込む（nil = フィルタなし）。
	Status *ReportStatus
	// From は period_start >= From で絞り込む（nil = フィルタなし）。
	From *time.Time
	// To は period_end <= To で絞り込む（nil = フィルタなし）。
	To *time.Time
	// SubmitterID はレポート作成者の UserID で絞り込む（nil = フィルタなし）。
	SubmitterID *uuid.UUID
	// Page は取得するページ番号（1始まり）。
	Page int
	// PerPage は1ページあたりの最大取得件数。
	PerPage int
}

// WorkflowListParams はワークフロー一覧エンドポイントのページネーションパラメータを保持する。
type WorkflowListParams struct {
	// ApplicantName は申請者名で絞り込む（部分一致、nil = フィルタなし）。
	ApplicantName *string
	// Page は取得するページ番号（1始まり）。
	Page int
	// PerPage は1ページあたりの最大取得件数。
	PerPage int
}

// TenantRepository は Tenant エンティティの永続化操作を提供する。
type TenantRepository interface {
	// Create は新しいテナントを保存し、作成されたレコードを返す。
	Create(ctx context.Context, companyName string) (*Tenant, error)
	// GetByID は主キーでテナントを取得する。
	GetByID(ctx context.Context, tenantID uuid.UUID) (*Tenant, error)
}

// UserRepository は User エンティティの永続化操作を提供する。
type UserRepository interface {
	// Create は新しいユーザーを保存し、作成されたレコードを返す。
	Create(ctx context.Context, email, name, passwordHash string) (*User, error)
	// GetByID は主キーでユーザーを取得する。
	GetByID(ctx context.Context, userID uuid.UUID) (*User, error)
	// GetByEmail はメールアドレスでユーザーを取得する。
	GetByEmail(ctx context.Context, email string) (*User, error)
	// UpdatePassword はユーザーのパスワードハッシュを更新する。
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
}

// MembershipRepository は TenantMembership エンティティの永続化操作を提供する。
type MembershipRepository interface {
	// Create は新しいテナントメンバーシップを保存する。
	Create(ctx context.Context, tenantID, userID uuid.UUID, role Role) (*TenantMembership, error)
	// GetByUserID は指定ユーザーのメンバーシップを取得する（MVP: 1 ユーザー = 1 テナント）。
	GetByUserID(ctx context.Context, userID uuid.UUID) (*TenantMembership, error)
	// ListByTenantID はテナント内の全メンバーシップを取得する。
	ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]TenantMembership, error)
	// HasApprover はテナントに承認者が1人以上いる場合に true を返す。
	HasApprover(ctx context.Context, tenantID uuid.UUID) (bool, error)
}

// CategoryRepository は経費カテゴリマスターデータへの読み取りアクセスを提供する。
type CategoryRepository interface {
	// ListActive はテナント内で表示される有効なカテゴリを返す
	// （グローバルカテゴリ + テナント固有カテゴリ）。
	ListActive(ctx context.Context, tenantID uuid.UUID) ([]Category, error)
	// GetByID は指定テナントにスコープされた主キーでカテゴリを取得する
	// （テナント固有カテゴリ、または tenant_id IS NULL のグローバルカテゴリが対象）。
	GetByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*Category, error)
}

// ReportRepository は ExpenseReport エンティティの永続化操作を提供する。
type ReportRepository interface {
	// Create は新しい経費精算レポートを保存する。
	Create(ctx context.Context, tenantID, userID uuid.UUID, title string, periodStart, periodEnd time.Time, referenceReportID *uuid.UUID) (*ExpenseReport, error)
	// GetByID はテナントにスコープされたレポートを取得する。
	GetByID(ctx context.Context, tenantID, reportID uuid.UUID) (*ExpenseReport, error)
	// List はテナント内の指定パラメータに一致するレポートを取得する。
	// 戻り値の int は総件数（ページネーション用）。
	List(ctx context.Context, tenantID uuid.UUID, params ReportListParams) ([]ExpenseReport, int, error)
	// Update はレポートの部分更新（タイトル・期間フィールド）を適用する。
	// updatedAt を用いた楽観的ロックを実装し、バージョン不一致時は ErrConflict を返す。
	Update(ctx context.Context, report *ExpenseReport) error
	// UpdateStatus はレポートを新しいステータスに遷移させる。
	// updatedAt を用いた楽観的ロックを実装し、バージョン不一致時は ErrConflict を返す。
	UpdateStatus(ctx context.Context, report *ExpenseReport) error
	// SoftDelete はレポート（およびその明細・添付ファイル）を論理削除する。
	SoftDelete(ctx context.Context, tenantID, reportID uuid.UUID) error
	// CountByStatus はフィルタに一致するレポートのステータス別件数を返す。
	CountByStatus(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID) (map[ReportStatus]int, error)
	// MonthlySummary はテナント内の直近 numMonths か月分の月別 total_amount 集計を返す。
	MonthlySummary(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, numMonths int) ([]MonthlySummary, error)
	// ListPending はテナント内の申請中レポートを返す。
	// 戻り値の int は総件数（ページネーション用）。
	ListPending(ctx context.Context, tenantID uuid.UUID, params WorkflowListParams) ([]ExpenseReport, int, error)
	// ListPayable はテナント内の承認済みレポートを返す。
	// 戻り値の int は総件数（ページネーション用）。
	ListPayable(ctx context.Context, tenantID uuid.UUID, params WorkflowListParams) ([]ExpenseReport, int, error)
}

// ItemRepository は ExpenseItem エンティティの永続化操作を提供する。
type ItemRepository interface {
	// Create は新しい経費明細を保存し、レポートの合計金額を再計算する。
	Create(ctx context.Context, tenantID, reportID uuid.UUID, expenseDate time.Time, amount int, categoryID uuid.UUID, description string) (*ExpenseItem, error)
	// GetByID はテナントとレポートにスコープされた明細を取得する。
	GetByID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) (*ExpenseItem, error)
	// ListByReportID はレポートの全有効明細を取得する。
	ListByReportID(ctx context.Context, tenantID, reportID uuid.UUID) ([]ExpenseItem, error)
	// Update は変更可能な明細フィールドを置き換える。updatedAt を用いた楽観的ロックを実装する。
	Update(ctx context.Context, item *ExpenseItem) error
	// SoftDelete は明細（およびその添付ファイル）を論理削除し、レポートの合計金額を再計算する。
	SoftDelete(ctx context.Context, tenantID, reportID, itemID uuid.UUID) error
}

// AttachmentRepository は Attachment エンティティの永続化操作を提供する。
type AttachmentRepository interface {
	// Create は添付ファイルのメタデータを保存する。
	Create(ctx context.Context, tenantID, reportID, itemID uuid.UUID, fileName string, fileSize int, mimeType MimeType, s3Key string) (*Attachment, error)
	// GetByID はテナント・レポート・明細にスコープされた添付ファイルを取得する。
	GetByID(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) (*Attachment, error)
	// ListByItemID は明細の全有効添付ファイルを取得する。
	ListByItemID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) ([]Attachment, error)
	// SoftDelete は添付ファイルを論理削除する。
	SoftDelete(ctx context.Context, tenantID, reportID, itemID, attachmentID uuid.UUID) error
}

// RefreshTokenRepository は RefreshToken エンティティの永続化操作を提供する。
type RefreshTokenRepository interface {
	// Create は新しいリフレッシュトークンを保存する。
	Create(ctx context.Context, jti, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error)
	// GetByJTI は JWT ID でリフレッシュトークンを取得する。
	GetByJTI(ctx context.Context, jti uuid.UUID) (*RefreshToken, error)
	// Revoke はトークンを失効済みとしてマークする。
	Revoke(ctx context.Context, jti uuid.UUID) error
	// RevokeAllByUserID は指定ユーザーの全リフレッシュトークンを失効済みにする。
	// パスワードリセット後の強制ログアウトに使用する（security.md §2.3）。
	RevokeAllByUserID(ctx context.Context, userID uuid.UUID) error
}

// PasswordResetTokenRepository は PasswordResetToken エンティティの永続化操作を提供する。
type PasswordResetTokenRepository interface {
	// Create は新しいパスワードリセットトークンを保存する。
	Create(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*PasswordResetToken, error)
	// GetByTokenHash はハッシュ値で有効な（未使用かつ未期限切れ）トークンを取得する。
	GetByTokenHash(ctx context.Context, tokenHash string) (*PasswordResetToken, error)
	// MarkUsed はトークンを使用済みとして記録する（used_at = 現在時刻）。
	MarkUsed(ctx context.Context, id uuid.UUID) error
}
