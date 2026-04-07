package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
)

// テストフィクスチャ用の固定 UUID（test_strategy.md §4 参照）。
const (
	TenantAID       = "aaaaaaaa-0001-0001-0001-000000000001"
	TenantBID       = "bbbbbbbb-0002-0002-0002-000000000002"
	UserAdminID     = "aaaaaaaa-1111-1111-1111-000000000001"
	UserApproverID  = "aaaaaaaa-2222-2222-2222-000000000002"
	UserMemberID    = "aaaaaaaa-3333-3333-3333-000000000003"
	UserAccountingID = "aaaaaaaa-4444-4444-4444-000000000004"
	UserMemberBID   = "bbbbbbbb-3333-3333-3333-000000000003"

	// レポートフィクスチャ UUID（テナント A）。
	ReportDraftID        = "cccccccc-0001-0001-0001-000000000001"
	ReportDraftEmptyID   = "cccccccc-0001-0001-0001-000000000002"
	ReportSubmittedID    = "cccccccc-0002-0002-0002-000000000002"
	ReportApprovedID     = "cccccccc-0003-0003-0003-000000000003"
	ReportRejectedID     = "cccccccc-0004-0004-0004-000000000004"
	ReportPaidID         = "cccccccc-0005-0005-0005-000000000005"

	// レポートフィクスチャ UUID（テナント B）。
	ReportTenantBDraftID     = "eeeeeeee-0001-0001-0001-000000000001"
	ReportTenantBSubmittedID = "eeeeeeee-0002-0002-0002-000000000002"
	ReportTenantBApprovedID  = "eeeeeeee-0003-0003-0003-000000000003"

	// 経費項目フィクスチャ UUID。
	ItemDraftID = "dddddddd-0001-0001-0001-000000000001"

	// testPasswordHash は "TestPass1!" の Argon2id ハッシュ。パラメータ: m=65536, t=3, p=4, keyLen=32, saltLen=16。
	// 形式: $argon2id$v=19$m=65536,t=3,p=4$<salt_base64>$<hash_base64>
	// テスト実行時のコストを避けるため事前計算済み。
	testPasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$YB/V08KjuKzuFdPLBiaPq7OE5PSVT2yNSGGDgxPOO6E"
)

// SeedFixtures は標準テストフィクスチャをすべてテストデータベースに挿入する。
// RLS をバイパスするため、オーナーロールの直接コネクションを使用する。
// マイグレーションで挿入済みのグローバルカテゴリシードはここでは再挿入しない。
func SeedFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("testutil: SeedFixtures: failed to acquire connection: %v", err)
	}
	defer conn.Release()

	now := time.Now().UTC()
	periodStart := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	expenseDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	// --- テナント ---
	tenantAID := uuid.MustParse(TenantAID)
	tenantBID := uuid.MustParse(TenantBID)

	if _, err := conn.Exec(ctx,
		`INSERT INTO tenants (tenant_id, company_name, created_at, updated_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tenant_id) DO NOTHING`,
		tenantAID, "Test Company A", now, now,
	); err != nil {
		t.Fatalf("testutil: SeedFixtures: insert tenant A: %v", err)
	}

	if _, err := conn.Exec(ctx,
		`INSERT INTO tenants (tenant_id, company_name, created_at, updated_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tenant_id) DO NOTHING`,
		tenantBID, "Test Company B", now, now,
	); err != nil {
		t.Fatalf("testutil: SeedFixtures: insert tenant B: %v", err)
	}

	// --- ユーザー（テナント A）---
	type userSeed struct {
		id    string
		email string
		name  string
	}
	usersA := []userSeed{
		{UserAdminID, "test-admin@example.com", "Test Admin"},
		{UserApproverID, "test-approver@example.com", "Test Approver"},
		{UserMemberID, "test-member@example.com", "Test Member"},
		{UserAccountingID, "test-accounting@example.com", "Test Accounting"},
	}
	for _, u := range usersA {
		if _, err := conn.Exec(ctx,
			`INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (user_id) DO NOTHING`,
			uuid.MustParse(u.id), u.email, u.name, testPasswordHash, now, now,
		); err != nil {
			t.Fatalf("testutil: SeedFixtures: insert user %s: %v", u.id, err)
		}
	}

	// --- ユーザー（テナント B）---
	if _, err := conn.Exec(ctx,
		`INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id) DO NOTHING`,
		uuid.MustParse(UserMemberBID), "test-member-b@example.com", "Test Member B", testPasswordHash, now, now,
	); err != nil {
		t.Fatalf("testutil: SeedFixtures: insert user B: %v", err)
	}

	// --- メンバーシップ（テナント A）---
	type membershipSeed struct {
		tenantID string
		userID   string
		role     domain.Role
	}
	memberships := []membershipSeed{
		{TenantAID, UserAdminID, domain.RoleAdmin},
		{TenantAID, UserApproverID, domain.RoleApprover},
		{TenantAID, UserMemberID, domain.RoleMember},
		{TenantAID, UserAccountingID, domain.RoleAccounting},
		{TenantBID, UserMemberBID, domain.RoleMember},
	}
	for _, m := range memberships {
		if _, err := conn.Exec(ctx,
			`INSERT INTO tenant_memberships (tenant_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (tenant_id, user_id) DO NOTHING`,
			uuid.MustParse(m.tenantID), uuid.MustParse(m.userID), string(m.role), now, now,
		); err != nil {
			t.Fatalf("testutil: SeedFixtures: insert membership %s/%s: %v", m.tenantID, m.userID, err)
		}
	}

	// 経費項目フィクスチャで使用する交通費カテゴリ ID をマイグレーションシードから取得する。
	var transportCategoryID uuid.UUID
	if err := conn.QueryRow(ctx,
		`SELECT category_id FROM categories WHERE code = 'transportation' AND tenant_id IS NULL`,
	).Scan(&transportCategoryID); err != nil {
		t.Fatalf("testutil: SeedFixtures: resolve transportation category: %v", err)
	}

	// --- 経費レポート（テナント A）---
	memberID := uuid.MustParse(UserMemberID)

	type reportSeed struct {
		id     string
		status domain.ReportStatus
		title  string
	}
	reports := []reportSeed{
		{ReportDraftID, domain.ReportStatusDraft, "テスト下書きレポート"},
		{ReportDraftEmptyID, domain.ReportStatusDraft, "テスト下書き（明細なし）"},
		{ReportSubmittedID, domain.ReportStatusSubmitted, "テスト提出済みレポート"},
		{ReportApprovedID, domain.ReportStatusApproved, "テスト承認済みレポート"},
		{ReportRejectedID, domain.ReportStatusRejected, "テスト却下レポート"},
		{ReportPaidID, domain.ReportStatusPaid, "テスト支払済みレポート"},
	}
	for _, rep := range reports {
		if _, err := conn.Exec(ctx,
			`INSERT INTO expense_reports
			 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 ON CONFLICT (report_id) DO NOTHING`,
			uuid.MustParse(rep.id), tenantAID, memberID,
			rep.title, periodStart, periodEnd, string(rep.status), 0,
			now, now,
		); err != nil {
			t.Fatalf("testutil: SeedFixtures: insert report %s: %v", rep.id, err)
		}
	}

	// --- report_draft 用の経費項目 ---
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemDraftID), uuid.MustParse(ReportDraftID), tenantAID,
		expenseDate, 1000, transportCategoryID, "テスト交通費",
		now, now,
	); err != nil {
		t.Fatalf("testutil: SeedFixtures: insert item: %v", err)
	}

	// 経費項目を反映して report_draft の total_amount を更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = 1000 WHERE report_id = $1`,
		uuid.MustParse(ReportDraftID),
	); err != nil {
		t.Fatalf("testutil: SeedFixtures: update report_draft total_amount: %v", err)
	}

	// --- 経費レポート（テナント B）---
	memberBID := uuid.MustParse(UserMemberBID)
	type reportBSeed struct {
		id     string
		status domain.ReportStatus
		title  string
	}
	reportsB := []reportBSeed{
		{ReportTenantBDraftID, domain.ReportStatusDraft, "テナントB下書きレポート"},
		{ReportTenantBSubmittedID, domain.ReportStatusSubmitted, "テナントB提出済みレポート"},
		{ReportTenantBApprovedID, domain.ReportStatusApproved, "テナントB承認済みレポート"},
	}
	for _, rep := range reportsB {
		if _, err := conn.Exec(ctx,
			`INSERT INTO expense_reports
			 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 ON CONFLICT (report_id) DO NOTHING`,
			uuid.MustParse(rep.id), tenantBID, memberBID,
			rep.title, periodStart, periodEnd, string(rep.status), 0,
			now, now,
		); err != nil {
			t.Fatalf("testutil: SeedFixtures: insert tenant B report %s: %v", rep.id, err)
		}
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
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, tenantID, userID,
		params["title"], params["period_start"], params["period_end"],
		params["status"], params["total_amount"],
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
// テストヘルパーとして使用するため、panic は許容する。
func MustParseUUID(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		panic("invalid UUID: " + s + ": " + err.Error())
	}
	return id
}
