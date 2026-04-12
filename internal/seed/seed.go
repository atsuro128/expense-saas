// Package seed はローカル開発用フィクスチャ投入のコアロジックを提供する。
// testutil.SeedFixtures（テスト専用）と cmd/seed（スタンドアロン CLI）の両方から呼び出す。
// 投入内容は test_strategy.md §4.2/4.3/4.4 のフィクスチャ定義に準拠する。
package seed

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/pkg/s3"
)

// receiptSampleJPEG は seed CLI バイナリに埋め込むダミー JPEG ファイル。
// SMK-037「ダウンロード起動」スモークテストの前提データとして MinIO にアップロードする。
//
//go:embed testdata/receipt_sample.jpg
var receiptSampleJPEG []byte

// 標準フィクスチャの固定 UUID（test_strategy.md §4.2 参照）。
// testutil パッケージの定数と完全一致させる。
const (
	TenantAID        = "aaaaaaaa-0001-0001-0001-000000000001"
	TenantBID        = "bbbbbbbb-0002-0002-0002-000000000002"
	UserAdminID      = "aaaaaaaa-1111-1111-1111-000000000001"
	UserApproverID   = "aaaaaaaa-2222-2222-2222-000000000002"
	UserMemberID     = "aaaaaaaa-3333-3333-3333-000000000003"
	UserAccountingID = "aaaaaaaa-4444-4444-4444-000000000004"
	UserMemberBID    = "bbbbbbbb-3333-3333-3333-000000000003"

	// レポートフィクスチャ UUID（テナント A）。
	ReportDraftID      = "cccccccc-0001-0001-0001-000000000001"
	ReportDraftEmptyID = "cccccccc-0001-0001-0001-000000000002"
	ReportSubmittedID  = "cccccccc-0002-0002-0002-000000000002"
	ReportApprovedID   = "cccccccc-0003-0003-0003-000000000003"
	ReportRejectedID   = "cccccccc-0004-0004-0004-000000000004"
	ReportPaidID       = "cccccccc-0005-0005-0005-000000000005"

	// レポートフィクスチャ UUID（テナント B）。
	ReportTenantBDraftID     = "eeeeeeee-0001-0001-0001-000000000001"
	ReportTenantBSubmittedID = "eeeeeeee-0002-0002-0002-000000000002"
	ReportTenantBApprovedID  = "eeeeeeee-0003-0003-0003-000000000003"

	// 経費項目フィクスチャ UUID。
	ItemDraftID     = "dddddddd-0001-0001-0001-000000000001"
	ItemSubmittedID = "dddddddd-0002-0002-0002-000000000002"

	// 添付ファイルフィクスチャ UUID（SMK-037 ダウンロード確認用）。
	// reportSubmitted（cccccccc-0002-0002-0002-000000000002）に紐付く 1 件のみ投入する。
	AttachmentSubmittedID = "ffffffff-0001-0001-0001-000000000001"
)

// attachmentS3Key は添付フィクスチャの S3 オブジェクトキーを返す。
// files.md §2.2 の形式: {tenant_id}/{report_id}/{attachment_id}
func attachmentS3Key() string {
	return TenantAID + "/" + ReportSubmittedID + "/" + AttachmentSubmittedID
}

// Run は pool を使ってフィクスチャをすべてデータベースに投入する。
// pool はオーナーロール（expense_owner）の接続プールを使用すること。
// RLS をバイパスするためにオーナーロールが必要。
// 冪等性を担保するため ON CONFLICT DO NOTHING を使用している。
// 再実行時も既存データを壊さず、不足分のみ補完する。
//
// s3Client が nil でない場合、MinIO にダミーファイルをアップロードする。
// テスト環境（testutil.SeedFixtures）では nil を渡すことで S3 アップロードをスキップできる。
func Run(ctx context.Context, pool *pgxpool.Pool, s3Client *s3.Client) error {
	// パスワードハッシュを生成する（"TestPass1!" の Argon2id ハッシュ）。
	hasher := domain.NewArgon2idHasher()
	passwordHash, err := hasher.HashPassword("TestPass1!")
	if err != nil {
		return fmt.Errorf("seed: パスワードハッシュ生成失敗: %w", err)
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("seed: DB 接続取得失敗: %w", err)
	}
	defer conn.Release()

	now := time.Now().UTC()
	periodStart := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	expenseDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	tenantAID := uuid.MustParse(TenantAID)
	tenantBID := uuid.MustParse(TenantBID)

	// テナント投入。
	for _, row := range []struct {
		id   uuid.UUID
		name string
	}{
		{tenantAID, "Test Company A"},
		{tenantBID, "Test Company B"},
	} {
		if _, err := conn.Exec(ctx,
			`INSERT INTO tenants (tenant_id, company_name, created_at, updated_at) VALUES ($1, $2, $3, $4)
			 ON CONFLICT (tenant_id) DO NOTHING`,
			row.id, row.name, now, now,
		); err != nil {
			return fmt.Errorf("seed: テナント挿入失敗 [%s]: %w", row.id, err)
		}
	}

	// ユーザー投入（テナント A + テナント B）。
	type userRow struct {
		id    string
		email string
		name  string
	}
	users := []userRow{
		{UserAdminID, "test-admin@example.com", "Test Admin"},
		{UserApproverID, "test-approver@example.com", "Test Approver"},
		{UserMemberID, "test-member@example.com", "Test Member"},
		{UserAccountingID, "test-accounting@example.com", "Test Accounting"},
		{UserMemberBID, "test-member-b@example.com", "Test Member B"},
	}
	for _, u := range users {
		if _, err := conn.Exec(ctx,
			`INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (user_id) DO NOTHING`,
			uuid.MustParse(u.id), u.email, u.name, passwordHash, now, now,
		); err != nil {
			return fmt.Errorf("seed: ユーザー挿入失敗 [%s]: %w", u.id, err)
		}
	}

	// メンバーシップ投入。
	type membershipRow struct {
		tenantID string
		userID   string
		role     domain.Role
	}
	memberships := []membershipRow{
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
			return fmt.Errorf("seed: メンバーシップ挿入失敗 [%s/%s]: %w", m.tenantID, m.userID, err)
		}
	}

	// グローバルカテゴリ投入（test_strategy.md §4.4 の 6 種）。
	if _, err := conn.Exec(ctx, `
		INSERT INTO categories (category_id, tenant_id, code, name_ja, sort_order, is_active) VALUES
			(gen_random_uuid(), NULL, 'transportation', '交通費', 1, true),
			(gen_random_uuid(), NULL, 'accommodation', '宿泊費', 2, true),
			(gen_random_uuid(), NULL, 'food', '飲食費', 3, true),
			(gen_random_uuid(), NULL, 'supplies', '消耗品費', 4, true),
			(gen_random_uuid(), NULL, 'communication', '通信費', 5, true),
			(gen_random_uuid(), NULL, 'other', 'その他', 6, true)
		ON CONFLICT (code) WHERE tenant_id IS NULL DO NOTHING
	`); err != nil {
		return fmt.Errorf("seed: グローバルカテゴリ挿入失敗: %w", err)
	}

	// 交通費カテゴリ ID を取得する（経費項目の category_id に使用）。
	var transportCategoryID uuid.UUID
	if err := conn.QueryRow(ctx,
		`SELECT category_id FROM categories WHERE code = 'transportation' AND tenant_id IS NULL`,
	).Scan(&transportCategoryID); err != nil {
		return fmt.Errorf("seed: 交通費カテゴリ ID 取得失敗: %w", err)
	}

	// 経費レポート（テナント A）投入。
	memberID := uuid.MustParse(UserMemberID)
	type reportRow struct {
		id     string
		status domain.ReportStatus
		title  string
	}
	reportsA := []reportRow{
		{ReportDraftID, domain.ReportStatusDraft, "テスト下書きレポート"},
		{ReportDraftEmptyID, domain.ReportStatusDraft, "テスト下書き（明細なし）"},
		{ReportSubmittedID, domain.ReportStatusSubmitted, "テスト提出済みレポート"},
		{ReportApprovedID, domain.ReportStatusApproved, "テスト承認済みレポート"},
		{ReportRejectedID, domain.ReportStatusRejected, "テスト却下レポート"},
		{ReportPaidID, domain.ReportStatusPaid, "テスト支払済みレポート"},
	}
	for _, rep := range reportsA {
		if _, err := conn.Exec(ctx,
			`INSERT INTO expense_reports
			 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 ON CONFLICT (report_id) DO NOTHING`,
			uuid.MustParse(rep.id), tenantAID, memberID,
			rep.title, periodStart, periodEnd, string(rep.status), 0,
			now, now,
		); err != nil {
			return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", rep.id, err)
		}
	}

	// 経費項目（report_draft に 1 件）投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemDraftID), uuid.MustParse(ReportDraftID), tenantAID,
		expenseDate, 1000, transportCategoryID, "テスト交通費",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目挿入失敗: %w", err)
	}

	// report_draft の total_amount を経費項目に合わせて更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = 1000 WHERE report_id = $1`,
		uuid.MustParse(ReportDraftID),
	); err != nil {
		return fmt.Errorf("seed: report_draft total_amount 更新失敗: %w", err)
	}

	// 経費項目（report_submitted に 1 件）投入。
	// SMK-037 の前提データとして添付ファイルを紐付けるために必要。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemSubmittedID), uuid.MustParse(ReportSubmittedID), tenantAID,
		expenseDate, 2000, transportCategoryID, "テスト交通費（提出済み）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（提出済み）挿入失敗: %w", err)
	}

	// report_submitted の total_amount を経費項目に合わせて更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = 2000 WHERE report_id = $1`,
		uuid.MustParse(ReportSubmittedID),
	); err != nil {
		return fmt.Errorf("seed: report_submitted total_amount 更新失敗: %w", err)
	}

	// 添付ファイルレコード投入（SMK-037 ダウンロード確認用）。
	// reportSubmitted に紐付く 1 件のみ投入する（最小限スコープ）。
	// s3_key は files.md §2.2 の形式: {tenant_id}/{report_id}/{attachment_id}
	s3Key := attachmentS3Key()
	if _, err := conn.Exec(ctx,
		`INSERT INTO attachments
		 (attachment_id, item_id, report_id, tenant_id, file_name, file_size, mime_type, s3_key, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (attachment_id) DO NOTHING`,
		uuid.MustParse(AttachmentSubmittedID),
		uuid.MustParse(ItemSubmittedID),
		uuid.MustParse(ReportSubmittedID),
		tenantAID,
		"receipt_sample.jpg",
		len(receiptSampleJPEG),
		string(domain.MimeTypeImageJpeg),
		s3Key,
		now,
	); err != nil {
		return fmt.Errorf("seed: 添付ファイルレコード挿入失敗: %w", err)
	}

	// MinIO にダミーファイルをアップロードする。
	// s3Client が nil の場合（テスト環境等）はスキップする。
	if s3Client != nil {
		if err := s3Client.Upload(ctx, s3Key, bytes.NewReader(receiptSampleJPEG), string(domain.MimeTypeImageJpeg)); err != nil {
			return fmt.Errorf("seed: MinIO アップロード失敗 [key=%s]: %w", s3Key, err)
		}
	}

	// 経費レポート（テナント B）投入。
	memberBID := uuid.MustParse(UserMemberBID)
	reportsB := []reportRow{
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
			return fmt.Errorf("seed: テナントB レポート挿入失敗 [%s]: %w", rep.id, err)
		}
	}

	return nil
}
