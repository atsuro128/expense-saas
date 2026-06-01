package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/seed"
)

// テストフィクスチャ用の固定 UUID（test_strategy.md §4 参照）。
// 値は internal/seed パッケージの定数と完全一致させる。
// 後方互換性維持のため testutil パッケージ内に定数を再エクスポートする。
const (
	TenantAID         = seed.TenantAID
	TenantBID         = seed.TenantBID
	UserAdminID       = seed.UserAdminID
	UserApproverID    = seed.UserApproverID
	UserMemberID      = seed.UserMemberID
	UserAccountingID  = seed.UserAccountingID
	UserMemberBID     = seed.UserMemberBID
	UserMemberEmptyID = seed.UserMemberEmptyID
	// SMK-104 用: テナント B Approver。
	UserApproverBID = seed.UserApproverBID
	// issue-109 ステップ1: テナント B Admin（業務モデル整合のため追加）。
	UserAdminBID = seed.UserAdminBID
	// SMK-105 用: テナント A 第二 Approver。
	UserApprover2ID = seed.UserApprover2ID

	// レポートフィクスチャ UUID（テナント A）。
	ReportDraftID      = seed.ReportDraftID
	ReportDraftEmptyID = seed.ReportDraftEmptyID
	ReportSubmittedID  = seed.ReportSubmittedID
	ReportApprovedID   = seed.ReportApprovedID
	ReportRejectedID   = seed.ReportRejectedID
	ReportPaidID       = seed.ReportPaidID

	// レポートフィクスチャ UUID（テナント B）。
	ReportTenantBDraftID     = seed.ReportTenantBDraftID
	ReportTenantBSubmittedID = seed.ReportTenantBSubmittedID
	ReportTenantBApprovedID  = seed.ReportTenantBApprovedID

	// SMK-105 用: テナント A 第二 Approver (UserApprover2ID) が承認したレポート。
	ReportApprovedByApprover2ID = seed.ReportApprovedByApprover2ID

	// 経費項目フィクスチャ UUID。
	ItemDraftID     = seed.ItemDraftID
	ItemSubmittedID = seed.ItemSubmittedID

	// 添付ファイルフィクスチャ UUID。
	// AttachmentSubmittedID は SMK-037（ダウンロード確認）用に reportSubmitted に紐付く。
	// AttachmentDraftID は SMK-038（削除確認）用に reportDraft に紐付く。
	AttachmentSubmittedID = seed.AttachmentSubmittedID
	AttachmentDraftID     = seed.AttachmentDraftID
)

// testPasswordHash は "TestPass1!" の Argon2id ハッシュ。
// テスト起動時（init）に domain.Argon2idHasher で動的生成する。
var testPasswordHash string

func init() {
	// "TestPass1!" のハッシュをテスト起動時に 1 回だけ生成する。
	// 固定値では Argon2id の検証で不一致が生じるため動的生成を採用。
	hasher := domain.NewArgon2idHasher()
	hash, err := hasher.HashPassword("TestPass1!")
	if err != nil {
		panic("testutil: failed to hash test password: " + err.Error())
	}
	testPasswordHash = hash
}

// SeedFixtures は標準テストフィクスチャをすべてテストデータベースに挿入する。
// RLS をバイパスするため、オーナーロールの直接コネクションを使用する。
// 内部実装は internal/seed.Run に委譲しており、testutil と seed CLI で同一データを投入する。
func SeedFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	// テスト環境では S3 クライアントを渡さない（nil）ため、MinIO アップロードはスキップされる。
	// 添付ファイルの DB レコードのみ投入し、実ファイルのアップロードは行わない。
	if err := seed.Run(context.Background(), pool, nil); err != nil {
		t.Fatalf("testutil: SeedFixtures: %v", err)
	}
}

// --- 個別ファクトリ関数（Option パターン）---

// TenantOption は CreateTenant の関数型オプション。
type TenantOption func(m map[string]interface{})

// CreateTenant はテナントを挿入してその UUID を返す。
func CreateTenant(t *testing.T, pool *pgxpool.Pool, opts ...TenantOption) uuid.UUID {
	t.Helper()

	params := map[string]interface{}{
		"company_name": "Factory Tenant",
	}
	for _, o := range opts {
		o(params)
	}

	id := uuid.New()
	now := time.Now().UTC()

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateTenant: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO tenants (tenant_id, company_name, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
		id, params["company_name"], now, now,
	); err != nil {
		t.Fatalf("testutil: CreateTenant: %v", err)
	}
	return id
}

// WithTenantName は CreateTenant の company_name を設定する。
func WithTenantName(name string) TenantOption {
	return func(m map[string]interface{}) {
		m["company_name"] = name
	}
}

// UserOption は CreateUser の関数型オプション。
type UserOption func(m map[string]interface{})

// CreateUser はユーザーを挿入してその UUID を返す。
func CreateUser(t *testing.T, pool *pgxpool.Pool, opts ...UserOption) uuid.UUID {
	t.Helper()

	id := uuid.New()
	params := map[string]interface{}{
		"email":         "user-" + id.String() + "@example.com",
		"name":          "Factory User",
		"password_hash": testPasswordHash,
	}
	for _, o := range opts {
		o(params)
	}

	now := time.Now().UTC()
	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateUser: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		id, params["email"], params["name"], params["password_hash"], now, now,
	); err != nil {
		t.Fatalf("testutil: CreateUser: %v", err)
	}
	return id
}

// WithUserEmail は CreateUser の email を設定する。
func WithUserEmail(email string) UserOption {
	return func(m map[string]interface{}) {
		m["email"] = email
	}
}

// WithUserName は CreateUser の name を設定する。
func WithUserName(name string) UserOption {
	return func(m map[string]interface{}) {
		m["name"] = name
	}
}

// MembershipOption は CreateMembership の関数型オプション。
type MembershipOption func(m map[string]interface{})

// CreateMembership は tenant_membership レコードを挿入する。
func CreateMembership(t *testing.T, pool *pgxpool.Pool, tenantID, userID uuid.UUID, role domain.Role, opts ...MembershipOption) {
	t.Helper()

	now := time.Now().UTC()
	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateMembership: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO tenant_memberships (tenant_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tenant_id, user_id) DO NOTHING`,
		tenantID, userID, string(role), now, now,
	); err != nil {
		t.Fatalf("testutil: CreateMembership: %v", err)
	}
}

// ReportOption は CreateReport の関数型オプション。
type ReportOption func(m map[string]interface{})

// CreateReport は expense_report を挿入してその UUID を返す。
func CreateReport(t *testing.T, pool *pgxpool.Pool, tenantID, userID uuid.UUID, opts ...ReportOption) uuid.UUID {
	t.Helper()

	id := uuid.New()
	now := time.Now().UTC()
	params := map[string]interface{}{
		"title":        "Factory Report",
		"period_start": time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		"period_end":   time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
		"status":       string(domain.ReportStatusDraft),
		"total_amount": 0,
		"submitted_at": (*time.Time)(nil),
		"approved_by":  (*uuid.UUID)(nil),
		"approved_at":  (*time.Time)(nil),
		"rejected_by":  (*uuid.UUID)(nil),
		"rejected_at":  (*time.Time)(nil),
	}
	for _, o := range opts {
		o(params)
	}

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateReport: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_at, approved_by, approved_at, rejected_by, rejected_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		id, tenantID, userID,
		params["title"], params["period_start"], params["period_end"],
		params["status"], params["total_amount"],
		params["submitted_at"],
		params["approved_by"], params["approved_at"],
		params["rejected_by"], params["rejected_at"],
		now, now,
	); err != nil {
		t.Fatalf("testutil: CreateReport: %v", err)
	}
	return id
}

// WithReportTitle は CreateReport の title を設定する。
func WithReportTitle(title string) ReportOption {
	return func(m map[string]interface{}) {
		m["title"] = title
	}
}

// WithReportStatus は CreateReport の status を設定する。
func WithReportStatus(status domain.ReportStatus) ReportOption {
	return func(m map[string]interface{}) {
		m["status"] = string(status)
	}
}

// WithReportTotalAmount は CreateReport の total_amount を設定する。
func WithReportTotalAmount(amount int) ReportOption {
	return func(m map[string]interface{}) {
		m["total_amount"] = amount
	}
}

// WithReportSubmittedAt は CreateReport の submitted_at を設定する。
func WithReportSubmittedAt(t time.Time) ReportOption {
	return func(m map[string]interface{}) {
		m["submitted_at"] = t
	}
}

// WithReportApprovedBy は CreateReport の approved_by と approved_at を設定する。
// 処理済みレポート一覧（SCR-WFL-003）のテストで使用する。
func WithReportApprovedBy(approverID uuid.UUID, approvedAt time.Time) ReportOption {
	return func(m map[string]interface{}) {
		m["approved_by"] = &approverID
		m["approved_at"] = &approvedAt
	}
}

// WithReportRejectedBy は CreateReport の rejected_by と rejected_at を設定する。
// 処理済みレポート一覧（SCR-WFL-003）のテストで使用する。
func WithReportRejectedBy(rejectorID uuid.UUID, rejectedAt time.Time) ReportOption {
	return func(m map[string]interface{}) {
		m["rejected_by"] = &rejectorID
		m["rejected_at"] = &rejectedAt
	}
}

// WithReportPeriodStart は CreateReport の period_start を設定する。
// monthly_summary の集計軸は period_start であるため、集計対象月を制御するために使用する。
func WithReportPeriodStart(t time.Time) ReportOption {
	return func(m map[string]interface{}) {
		m["period_start"] = t
	}
}

// WithReportPeriodEnd は CreateReport の period_end を設定する。
// period_start と合わせて指定することで CHECK (period_start <= period_end) 制約違反を防ぐ。
func WithReportPeriodEnd(t time.Time) ReportOption {
	return func(m map[string]interface{}) {
		m["period_end"] = t
	}
}

// ItemOption は CreateItem の関数型オプション。
type ItemOption func(m map[string]interface{})

// CreateItem は expense_item を挿入してその UUID を返す。
func CreateItem(t *testing.T, pool *pgxpool.Pool, tenantID, reportID, categoryID uuid.UUID, opts ...ItemOption) uuid.UUID {
	t.Helper()

	id := uuid.New()
	now := time.Now().UTC()
	params := map[string]interface{}{
		"expense_date": time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		"amount":       1000,
		"description":  "Factory Item",
	}
	for _, o := range opts {
		o(params)
	}

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateItem: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, reportID, tenantID,
		params["expense_date"], params["amount"], categoryID, params["description"],
		now, now,
	); err != nil {
		t.Fatalf("testutil: CreateItem: %v", err)
	}
	return id
}

// WithItemAmount は CreateItem の amount を設定する。
func WithItemAmount(amount int) ItemOption {
	return func(m map[string]interface{}) {
		m["amount"] = amount
	}
}

// WithItemDescription は CreateItem の description を設定する。
func WithItemDescription(desc string) ItemOption {
	return func(m map[string]interface{}) {
		m["description"] = desc
	}
}

// AttachmentOption は CreateAttachment の関数型オプション。
type AttachmentOption func(m map[string]interface{})

// CreateAttachment は添付ファイルレコードを挿入してその UUID を返す。
// tenantID, reportID, itemID は必須で、外部キー制約により強制される。
// デフォルト値: file_name="receipt.jpg", file_size=1024, mime_type="image/jpeg",
// s3_key はテナント/レポート/アイテム/添付ファイル各 ID から生成される。
func CreateAttachment(t *testing.T, pool *pgxpool.Pool, tenantID, reportID, itemID uuid.UUID, opts ...AttachmentOption) uuid.UUID {
	t.Helper()

	id := uuid.New()
	now := time.Now().UTC()
	params := map[string]interface{}{
		"file_name": "receipt.jpg",
		"file_size": 1024,
		"mime_type": string(domain.MimeTypeImageJpeg),
		"s3_key":    tenantID.String() + "/reports/" + reportID.String() + "/items/" + itemID.String() + "/" + id.String() + ".jpg",
	}
	for _, o := range opts {
		o(params)
	}

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: CreateAttachment: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO attachments
		 (attachment_id, item_id, report_id, tenant_id, file_name, file_size, mime_type, s3_key, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, itemID, reportID, tenantID,
		params["file_name"], params["file_size"], params["mime_type"], params["s3_key"],
		now,
	); err != nil {
		t.Fatalf("testutil: CreateAttachment: %v", err)
	}
	return id
}

// WithAttachmentFileName は CreateAttachment の file_name を設定する。
func WithAttachmentFileName(name string) AttachmentOption {
	return func(m map[string]interface{}) {
		m["file_name"] = name
	}
}

// WithAttachmentFileSize は CreateAttachment の file_size を設定する。
func WithAttachmentFileSize(size int) AttachmentOption {
	return func(m map[string]interface{}) {
		m["file_size"] = size
	}
}

// WithAttachmentMimeType は CreateAttachment の mime_type を設定する。
func WithAttachmentMimeType(mt domain.MimeType) AttachmentOption {
	return func(m map[string]interface{}) {
		m["mime_type"] = string(mt)
	}
}

// WithAttachmentS3Key は CreateAttachment の s3_key を設定する。
func WithAttachmentS3Key(key string) AttachmentOption {
	return func(m map[string]interface{}) {
		m["s3_key"] = key
	}
}

// MustParseUUID は文字列を UUID にパースして返す。パースに失敗した場合は panic する。
// テスト用定数（TenantAID 等）を UUID 型に変換するためのヘルパー。
func MustParseUUID(s string) uuid.UUID {
	return uuid.MustParse(s)
}

// GetTransportCategoryID はマイグレーションシードから交通費カテゴリ ID を取得して返す。
// テストで経費項目を作成する際に使用する。
func GetTransportCategoryID(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()

	var categoryID uuid.UUID
	if err := pool.QueryRow(context.Background(),
		`SELECT category_id FROM categories WHERE code = 'transportation' AND tenant_id IS NULL`,
	).Scan(&categoryID); err != nil {
		t.Fatalf("testutil: GetTransportCategoryID: %v", err)
	}
	return categoryID
}

// SoftDeleteAttachment は指定した添付ファイルを論理削除する（deleted_at に現在時刻を設定）。
// ATT-054（削除済み添付への再削除）のテスト前提条件として使用する。
func SoftDeleteAttachment(t *testing.T, pool *pgxpool.Pool, attachmentID uuid.UUID) {
	t.Helper()

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("testutil: SoftDeleteAttachment: acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(),
		`UPDATE attachments SET deleted_at = NOW() WHERE attachment_id = $1`,
		attachmentID,
	); err != nil {
		t.Fatalf("testutil: SoftDeleteAttachment: %v", err)
	}
}
