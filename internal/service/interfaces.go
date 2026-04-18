package service

import (
	"context"
	"io"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// StorageClient はオブジェクトストレージ（S3/MinIO）への操作を抽象化するインターフェース。
// テスト時はインメモリモックに差し替える。
type StorageClient interface {
	// Upload はオブジェクトをストレージにアップロードする。
	Upload(ctx context.Context, key string, data io.Reader, contentType string) error
	// PresignGetObject は指定オブジェクトの署名付き URL を生成する。
	// disposition は ResponseContentDisposition に設定する値（"attachment; filename=..." または "inline; filename=..."）。
	// expiry は URL の有効期限、expiresAt は有効期限の絶対日時を返す。
	PresignGetObject(ctx context.Context, key, fileName, mimeType, disposition string, expiry time.Duration) (url string, expiresAt time.Time, err error)
	// Delete はオブジェクトをストレージから削除する。
	Delete(ctx context.Context, key string) error
}

// AuthService はユーザー登録・ログイン・トークン管理・パスワードリセットを担う。
type AuthService interface {
	// Signup は新規テナントと管理者ユーザーを作成し、認証トークンを返す。
	Signup(ctx context.Context, params SignupParams) (*AuthResult, error)
	// Login はメールアドレスとパスワードでユーザーを認証し、認証トークンを返す。
	Login(ctx context.Context, email, password string) (*AuthResult, error)
	// RefreshToken は有効な refresh token を使って新しいアクセス/refresh token ペアを発行する。
	RefreshToken(ctx context.Context, refreshToken string) (*AuthResult, error)
	// Logout は指定された refresh token を無効化する。
	Logout(ctx context.Context, refreshToken string) error
	// GetMe は認証済みユーザーのプロフィールを返す。
	GetMe(ctx context.Context, actor domain.Actor) (*UserProfile, error)
	// RequestPasswordReset はパスワードリセットメールを送信する。
	RequestPasswordReset(ctx context.Context, email string) error
	// ExecutePasswordReset はトークンを検証してパスワードを更新する。
	ExecutePasswordReset(ctx context.Context, token, newPassword string) error
}

// ReportService は経費レポートの CRUD および一覧取得を担う。
type ReportService interface {
	// CreateReport は操作者が所有する新規経費レポートを作成する。
	CreateReport(ctx context.Context, actor domain.Actor, params CreateReportParams) (*ExpenseReportDetail, error)
	// GetReport は単一レポートの詳細を取得する。
	GetReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) (*ExpenseReportDetail, error)
	// ListMyReports は操作者が所有するレポートをカーソルページネーション付きで一覧取得する。
	ListMyReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]ExpenseReportSummary, *Pagination, error)
	// ListAllReports はテナント内の全レポートを一覧取得する（Admin / Accounting 専用）。
	ListAllReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]ExpenseReportSummary, *Pagination, error)
	// UpdateReport は下書きレポートの変更可能フィールドを更新する。
	UpdateReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params UpdateReportParams) (*ExpenseReportDetail, error)
	// DeleteReport は下書きレポートを論理削除する。
	DeleteReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) error
	// SubmitReport は下書きレポートを提出済みステータスへ遷移させる。
	SubmitReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*ExpenseReportDetail, error)
}

// ItemService は経費レポート内の明細（経費項目）の CRUD を担う。
type ItemService interface {
	// CreateItem は下書きレポートに新規経費項目を作成する。
	CreateItem(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params CreateItemParams) (*ExpenseItemDTO, error)
	// UpdateItem は経費項目の変更可能フィールドを更新する。
	UpdateItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, params UpdateItemParams) (*ExpenseItemDTO, error)
	// DeleteItem は経費項目を論理削除する。
	DeleteItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) error
}

// AttachmentService は添付ファイルのアップロードと取得を担う。
type AttachmentService interface {
	// UploadAttachment はファイルを保存し、添付ファイルのメタデータを永続化する。
	UploadAttachment(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, upload FileUpload) (*AttachmentDTO, error)
	// ListAttachments は経費項目に紐づく有効な添付ファイルを全件取得する。
	ListAttachments(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) ([]AttachmentDTO, error)
	// GetAttachmentDownload はダウンロード用の署名付き URL（Content-Disposition: attachment）を返す。
	GetAttachmentDownload(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) (*AttachmentAccess, error)
	// GetAttachmentPreview はプレビュー用の署名付き URL（Content-Disposition: inline）を返す。
	GetAttachmentPreview(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) (*AttachmentAccess, error)
	// DeleteAttachment は添付ファイルを論理削除する。
	DeleteAttachment(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) error
}

// WorkflowService は経費レポートの承認・却下・支払処理を担う。
type WorkflowService interface {
	// ListPendingReports は承認待ちの提出済みレポートを一覧取得する。
	ListPendingReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]PendingReport, *Pagination, error)
	// ApproveReport は提出済みレポートを承認済みステータスへ遷移させる。
	ApproveReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, comment *string, updatedAt time.Time) (*ExpenseReportDetail, error)
	// RejectReport は提出済みレポートを却下済みステータスへ遷移させる。
	RejectReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, reason string, updatedAt time.Time) (*ExpenseReportDetail, error)
	// ListPayableReports は支払待ちの承認済みレポートを一覧取得する。
	ListPayableReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]PayableReport, *Pagination, error)
	// MarkReportAsPaid は承認済みレポートを支払済みステータスへ遷移させる。
	MarkReportAsPaid(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*ExpenseReportDetail, error)
}

// DashboardService はロール別のダッシュボードデータを構築する。
type DashboardService interface {
	// GetDashboard は認証済み操作者向けのダッシュボードデータを返す。
	GetDashboard(ctx context.Context, actor domain.Actor) (*DashboardData, error)
}

// CategoryService は経費カテゴリのマスタデータへの読み取りアクセスを提供する。
type CategoryService interface {
	// ListCategories は操作者のテナントで参照可能な有効カテゴリを返す。
	ListCategories(ctx context.Context, actor domain.Actor) ([]CategoryDTO, error)
}

// TenantService はテナントおよびメンバーシップ情報を提供する。
type TenantService interface {
	// GetTenant はテナントの基本情報を返す（Admin 専用）。
	GetTenant(ctx context.Context, actor domain.Actor) (*TenantInfoDTO, error)
	// ListTenantMembers は操作者のテナント内の全有効メンバーを返す。
	ListTenantMembers(ctx context.Context, actor domain.Actor) ([]UserSummary, error)
}
