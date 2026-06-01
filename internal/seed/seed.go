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
	TenantAID         = "aaaaaaaa-0001-0001-0001-000000000001"
	TenantBID         = "bbbbbbbb-0002-0002-0002-000000000002"
	UserAdminID       = "aaaaaaaa-1111-1111-1111-000000000001"
	UserApproverID    = "aaaaaaaa-2222-2222-2222-000000000002"
	UserMemberID      = "aaaaaaaa-3333-3333-3333-000000000003"
	UserAccountingID  = "aaaaaaaa-4444-4444-4444-000000000004"
	UserMemberBID     = "bbbbbbbb-3333-3333-3333-000000000003"
	UserMemberEmptyID = "aaaaaaaa-3333-3333-3333-000000000004"
	// SMK-104 用: テナント B Approver。
	UserApproverBID = "bbbbbbbb-2222-2222-2222-000000000022"
	// issue-109 ステップ1: テナント B Admin（業務モデル整合のため追加）。
	// 命名規則: bbbbbbbb-1111-1111-1111-000000000011（テナント B = bbbb, Admin = 1111 系）。
	UserAdminBID = "bbbbbbbb-1111-1111-1111-000000000011"
	// SMK-105 用: テナント A 第二 Approver。
	UserApprover2ID = "aaaaaaaa-2222-2222-2222-000000000023"

	// レポートフィクスチャ UUID（テナント A）。
	ReportDraftID      = "cccccccc-0001-0001-0001-000000000001"
	ReportDraftEmptyID = "cccccccc-0001-0001-0001-000000000002"
	ReportSubmittedID  = "cccccccc-0002-0002-0002-000000000002"
	ReportApprovedID   = "cccccccc-0003-0003-0003-000000000003"
	ReportRejectedID   = "cccccccc-0004-0004-0004-000000000004"
	ReportPaidID       = "cccccccc-0005-0005-0005-000000000005"

	// 追加 paid レポート UUID（テナント A）。
	// issue-087: Admin ダッシュボード月別合計 0 円対応 — 複数月に分散して paid レポートを追加する。
	// period_start/end は Run() 内で time.Now() 基準の直近 3 ヶ月（当月・前月・前々月）に動的生成する。
	// 命名規則: dddddddd-000N-000N-000N-000000000001（N=連番）
	ReportPaidPrev2ID = "dddddddd-0002-0002-0002-000000000001" // 前々月
	ReportPaidCurID   = "dddddddd-0003-0003-0003-000000000001" // 当月

	// レポートフィクスチャ UUID（テナント B）。
	ReportTenantBDraftID     = "eeeeeeee-0001-0001-0001-000000000001"
	ReportTenantBSubmittedID = "eeeeeeee-0002-0002-0002-000000000002"
	ReportTenantBApprovedID  = "eeeeeeee-0003-0003-0003-000000000003"

	// SMK-105 用: テナント A 第二 Approver (UserApprover2ID) が承認したレポート。
	ReportApprovedByApprover2ID = "cccccccc-9999-9999-9999-000000000099"

	// 経費項目フィクスチャ UUID。
	ItemDraftID     = "dddddddd-0001-0001-0001-000000000001"
	ItemSubmittedID = "dddddddd-0002-0002-0002-000000000002"

	// 追加 expense_items UUID（issue-087 対応）。
	// approved / rejected / 追加 paid レポートの total_amount を 0 円以外にするために使用する。
	// 命名規則: eeeeeeee-000N-000N-000N-000000000001（N=連番）
	ItemApprovedID   = "eeeeeeee-0002-0002-0002-000000000001"
	ItemRejectedID   = "eeeeeeee-0003-0003-0003-000000000001"
	ItemPaid2026Feb1 = "eeeeeeee-0004-0004-0004-000000000001"
	ItemPaid2026Apr1 = "eeeeeeee-0005-0005-0005-000000000001"
	ItemPaid2026Mar1 = "eeeeeeee-0006-0006-0006-000000000001"

	// 添付ファイルフィクスチャ UUID。
	// AttachmentSubmittedID は SMK-037（ダウンロード確認）用に reportSubmitted に紐付く。
	// AttachmentDraftID は SMK-038（削除確認）用に reportDraft に紐付く。
	AttachmentSubmittedID = "ffffffff-0001-0001-0001-000000000001"
	AttachmentDraftID     = "ffffffff-0002-0002-0002-000000000002"
)

// attachmentS3Key は reportSubmitted 向け添付フィクスチャの S3 オブジェクトキーを返す。
// files.md §2.2 の形式: {tenant_id}/{report_id}/{attachment_id}
func attachmentS3Key() string {
	return TenantAID + "/" + ReportSubmittedID + "/" + AttachmentSubmittedID
}

// attachmentDraftS3Key は reportDraft 向け添付フィクスチャの S3 オブジェクトキーを返す。
// files.md §2.2 の形式: {tenant_id}/{report_id}/{attachment_id}
func attachmentDraftS3Key() string {
	return TenantAID + "/" + ReportDraftID + "/" + AttachmentDraftID
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
	// draft / submitted / approved / rejected レポートの基準期間は固定（テスト参照性を維持）。
	periodStart := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	expenseDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	// submitted / approved / rejected の状態タイムスタンプ（問題③: NULL 修正用）。
	ts202603 := time.Date(2026, 3, 15, 10, 0, 0, 0, time.UTC)

	// paid レポート 3 件を直近 3 ヶ月（当月・前月・前々月）に動的生成する。
	// dashboard rolling 3 months 集計（CURRENT_DATE - INTERVAL '2 months'）に常に含まれるようにする。
	curMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	curMonthEnd := curMonthStart.AddDate(0, 1, -1)
	curMonthExpDate := curMonthStart.AddDate(0, 0, 9)
	curMonthTS := curMonthStart.AddDate(0, 0, 14).Add(10 * time.Hour)

	prevMonthStart := curMonthStart.AddDate(0, -1, 0)
	prevMonthEnd := curMonthStart.AddDate(0, 0, -1)
	prevMonthExpDate := prevMonthStart.AddDate(0, 0, 9)
	prevMonthTS := prevMonthStart.AddDate(0, 0, 14).Add(10 * time.Hour)

	prev2MonthStart := curMonthStart.AddDate(0, -2, 0)
	prev2MonthEnd := curMonthStart.AddDate(0, -1, -1)
	prev2MonthExpDate := prev2MonthStart.AddDate(0, 0, 9)
	prev2MonthTS := prev2MonthStart.AddDate(0, 0, 14).Add(10 * time.Hour)

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
		{UserMemberEmptyID, "test-member-empty@example.com", "Test Member Empty"},
		// SMK-104 用: テナント B Approver。
		{UserApproverBID, "test-approver-b@example.com", "Test Approver B"},
		// issue-109 ステップ1: テナント B Admin（業務モデル整合のため追加）。
		{UserAdminBID, "test-admin-b@example.com", "Test Admin B"},
		// SMK-105 用: テナント A 第二 Approver。
		{UserApprover2ID, "test-approver2@example.com", "Test Approver Two"},
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
		{TenantAID, UserMemberEmptyID, domain.RoleMember},
		// SMK-104 用: テナント B Approver のメンバーシップ。
		{TenantBID, UserApproverBID, domain.RoleApprover},
		// issue-109 ステップ1: テナント B Admin のメンバーシップ（業務モデル整合のため追加）。
		{TenantBID, UserAdminBID, domain.RoleAdmin},
		// SMK-105 用: テナント A 第二 Approver のメンバーシップ。
		{TenantAID, UserApprover2ID, domain.RoleApprover},
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
	// 問題③: 各状態に対応するタイムスタンプを必ずセットする。
	memberID := uuid.MustParse(UserMemberID)
	approverID := uuid.MustParse(UserApproverID)
	accountingID := uuid.MustParse(UserAccountingID)

	// draft レポート 1: 明細 1 件あり。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportDraftID), tenantAID, memberID,
		"テスト下書きレポート", periodStart, periodEnd, string(domain.ReportStatusDraft), 0,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportDraftID, err)
	}

	// draft レポート 2: 明細なし。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportDraftEmptyID), tenantAID, memberID,
		"テスト下書き（明細なし）", periodStart, periodEnd, string(domain.ReportStatusDraft), 0,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportDraftEmptyID, err)
	}

	// submitted レポート: submitted_at をセット。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportSubmittedID), tenantAID, memberID,
		"テスト提出済みレポート", periodStart, periodEnd, string(domain.ReportStatusSubmitted), 0,
		memberID, ts202603,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportSubmittedID, err)
	}

	// approved レポート: submitted_at + approved_at をセット。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportApprovedID), tenantAID, memberID,
		"テスト承認済みレポート", periodStart, periodEnd, string(domain.ReportStatusApproved), 0,
		memberID, ts202603,
		approverID, ts202603,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportApprovedID, err)
	}

	// rejected レポート: submitted_at + rejected_at + rejection_reason をセット。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, rejected_by, rejected_at, rejection_reason, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportRejectedID), tenantAID, memberID,
		"テスト却下レポート", periodStart, periodEnd, string(domain.ReportStatusRejected), 0,
		memberID, ts202603,
		approverID, ts202603, "テスト却下理由",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportRejectedID, err)
	}

	// paid レポート（既存 UUID・前月）: submitted_at + approved_at + paid_at + paid_by をセット。
	// ReportPaidID は testutil/fixture.go で参照されているため UUID を変更しない。
	// period_start/end を直近 3 ヶ月の「前月」に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, paid_by, paid_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportPaidID), tenantAID, memberID,
		"テスト支払済みレポート（前月）",
		prevMonthStart, prevMonthEnd,
		string(domain.ReportStatusPaid), 0,
		memberID, prevMonthTS,
		approverID, prevMonthTS,
		accountingID, prevMonthTS,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportPaidID, err)
	}

	// paid レポート（追加・前々月）: 問題① — 複数月への分散。
	// period_start/end を直近 3 ヶ月の「前々月」に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, paid_by, paid_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportPaidPrev2ID), tenantAID, memberID,
		"テスト支払済みレポート（前々月）",
		prev2MonthStart, prev2MonthEnd,
		string(domain.ReportStatusPaid), 0,
		memberID, prev2MonthTS,
		approverID, prev2MonthTS,
		accountingID, prev2MonthTS,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportPaidPrev2ID, err)
	}

	// paid レポート（追加・当月）: 問題① — 複数月への分散。
	// period_start/end を直近 3 ヶ月の「当月」に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, paid_by, paid_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportPaidCurID), tenantAID, memberID,
		"テスト支払済みレポート（当月）",
		curMonthStart, curMonthEnd,
		string(domain.ReportStatusPaid), 0,
		memberID, curMonthTS,
		approverID, curMonthTS,
		accountingID, curMonthTS,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportPaidCurID, err)
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

	// 問題②: approved / rejected / 追加 paid レポートに expense_items を紐付け、
	// total_amount を 0 円以外にする。
	// 各レポートの expense_date は period に合わせて設定する。

	// 経費項目（report_approved に 1 件）投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemApprovedID), uuid.MustParse(ReportApprovedID), tenantAID,
		time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC), 3000, transportCategoryID, "テスト交通費（承認済み）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（承認済み）挿入失敗: %w", err)
	}

	// report_approved の total_amount を SUM(expense_items) で更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = (
			SELECT COALESCE(SUM(amount), 0) FROM expense_items
			WHERE report_id = $1 AND deleted_at IS NULL
		) WHERE report_id = $1`,
		uuid.MustParse(ReportApprovedID),
	); err != nil {
		return fmt.Errorf("seed: report_approved total_amount 更新失敗: %w", err)
	}

	// 経費項目（report_rejected に 1 件）投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemRejectedID), uuid.MustParse(ReportRejectedID), tenantAID,
		time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC), 1500, transportCategoryID, "テスト交通費（却下）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（却下）挿入失敗: %w", err)
	}

	// report_rejected の total_amount を SUM(expense_items) で更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = (
			SELECT COALESCE(SUM(amount), 0) FROM expense_items
			WHERE report_id = $1 AND deleted_at IS NULL
		) WHERE report_id = $1`,
		uuid.MustParse(ReportRejectedID),
	); err != nil {
		return fmt.Errorf("seed: report_rejected total_amount 更新失敗: %w", err)
	}

	// 経費項目（paid レポート・前月に 1 件）投入。
	// expense_date は前月の 10 日に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemPaid2026Mar1), uuid.MustParse(ReportPaidID), tenantAID,
		prevMonthExpDate, 5000, transportCategoryID, "テスト交通費（支払済み・前月）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（支払済み・前月）挿入失敗: %w", err)
	}

	// report_paid（前月）の total_amount を SUM(expense_items) で更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = (
			SELECT COALESCE(SUM(amount), 0) FROM expense_items
			WHERE report_id = $1 AND deleted_at IS NULL
		) WHERE report_id = $1`,
		uuid.MustParse(ReportPaidID),
	); err != nil {
		return fmt.Errorf("seed: report_paid（前月）total_amount 更新失敗: %w", err)
	}

	// 経費項目（paid レポート・前々月に 1 件）投入。
	// expense_date は前々月の 10 日に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemPaid2026Feb1), uuid.MustParse(ReportPaidPrev2ID), tenantAID,
		prev2MonthExpDate, 4000, transportCategoryID, "テスト交通費（支払済み・前々月）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（支払済み・前々月）挿入失敗: %w", err)
	}

	// report_paid（前々月）の total_amount を SUM(expense_items) で更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = (
			SELECT COALESCE(SUM(amount), 0) FROM expense_items
			WHERE report_id = $1 AND deleted_at IS NULL
		) WHERE report_id = $1`,
		uuid.MustParse(ReportPaidPrev2ID),
	); err != nil {
		return fmt.Errorf("seed: report_paid（前々月）total_amount 更新失敗: %w", err)
	}

	// 経費項目（paid レポート・当月に 1 件）投入。
	// expense_date は当月の 10 日に動的設定する。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_items
		 (item_id, report_id, tenant_id, expense_date, amount, category_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (item_id) DO NOTHING`,
		uuid.MustParse(ItemPaid2026Apr1), uuid.MustParse(ReportPaidCurID), tenantAID,
		curMonthExpDate, 6000, transportCategoryID, "テスト交通費（支払済み・当月）",
		now, now,
	); err != nil {
		return fmt.Errorf("seed: 経費項目（支払済み・当月）挿入失敗: %w", err)
	}

	// report_paid（当月）の total_amount を SUM(expense_items) で更新する。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports SET total_amount = (
			SELECT COALESCE(SUM(amount), 0) FROM expense_items
			WHERE report_id = $1 AND deleted_at IS NULL
		) WHERE report_id = $1`,
		uuid.MustParse(ReportPaidCurID),
	); err != nil {
		return fmt.Errorf("seed: report_paid（当月）total_amount 更新失敗: %w", err)
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

	// 添付ファイルレコード投入（SMK-038 削除確認用）。
	// reportDraft に紐付く 1 件を投入する。seed 再実行で SMK-038 実施後の削除状態を復元できる。
	// s3_key は files.md §2.2 の形式: {tenant_id}/{report_id}/{attachment_id}
	draftS3Key := attachmentDraftS3Key()
	if _, err := conn.Exec(ctx,
		`INSERT INTO attachments
		 (attachment_id, item_id, report_id, tenant_id, file_name, file_size, mime_type, s3_key, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (attachment_id) DO NOTHING`,
		uuid.MustParse(AttachmentDraftID),
		uuid.MustParse(ItemDraftID),
		uuid.MustParse(ReportDraftID),
		tenantAID,
		"receipt_sample.jpg",
		1024,
		string(domain.MimeTypeImageJpeg),
		draftS3Key,
		now,
	); err != nil {
		return fmt.Errorf("seed: 添付ファイルレコード挿入失敗（draft）: %w", err)
	}

	// MinIO に reportDraft 向けダミーファイルをアップロードする。
	// s3Client が nil の場合（テスト環境等）はスキップする。
	if s3Client != nil {
		if err := s3Client.Upload(ctx, draftS3Key, bytes.NewReader(receiptSampleJPEG), string(domain.MimeTypeImageJpeg)); err != nil {
			return fmt.Errorf("seed: MinIO アップロード失敗（draft）[key=%s]: %w", draftS3Key, err)
		}
	}

	// 経費レポート（テナント B）投入。
	memberBID := uuid.MustParse(UserMemberBID)
	approverBID := uuid.MustParse(UserApproverBID)

	// テナント B 下書きレポート。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportTenantBDraftID), tenantBID, memberBID,
		"テナントB下書きレポート", periodStart, periodEnd, string(domain.ReportStatusDraft), 0,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: テナントB レポート挿入失敗 [%s]: %w", ReportTenantBDraftID, err)
	}

	// テナント B 提出済みレポート。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportTenantBSubmittedID), tenantBID, memberBID,
		"テナントB提出済みレポート", periodStart, periodEnd, string(domain.ReportStatusSubmitted), 0,
		memberBID, ts202603,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: テナントB レポート挿入失敗 [%s]: %w", ReportTenantBSubmittedID, err)
	}

	// テナント B 承認済みレポート（SMK-104 用: テナント B Approver が承認した状態）。
	// approved_by に UserApproverBID をセットし、テナント B 側の処理済みレポートとして機能させる。
	//
	// INSERT は他のフィクスチャと同様に ON CONFLICT DO NOTHING とする（新規環境での投入用）。
	// origin/master の seed 済み環境では approved_by / approved_at が NULL のまま残るため、
	// INSERT 後に補完 UPDATE を実行して冪等性を確保する（既存行のみ対象）。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportTenantBApprovedID), tenantBID, memberBID,
		"テナントB承認済みレポート", periodStart, periodEnd, string(domain.ReportStatusApproved), 0,
		memberBID, ts202603,
		approverBID, ts202603,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: テナントB レポート挿入失敗 [%s]: %w", ReportTenantBApprovedID, err)
	}
	// 補完 UPDATE: ON CONFLICT DO NOTHING で INSERT がスキップされた既存行（approved_by が NULL の行）に
	// submitted_by / submitted_at / approved_by / approved_at を補完する。
	// WHERE 句で approved_by IS NULL を条件にすることで、補完済みの行には影響しない（冪等）。
	if _, err := conn.Exec(ctx,
		`UPDATE expense_reports
		 SET submitted_by = $2,
		     submitted_at = $3,
		     approved_by  = $4,
		     approved_at  = $5,
		     updated_at   = $6
		 WHERE report_id = $1
		   AND (approved_by IS NULL OR approved_at IS NULL)`,
		uuid.MustParse(ReportTenantBApprovedID),
		memberBID, ts202603,
		approverBID, ts202603,
		now,
	); err != nil {
		return fmt.Errorf("seed: テナントB 承認済みレポート補完 UPDATE 失敗 [%s]: %w", ReportTenantBApprovedID, err)
	}

	// テナント A 第二 Approver (UserApprover2ID) が承認したレポート（SMK-105 用）。
	// 「同テナント内の別 Approver が処理したレポート」を再現するための前提データ。
	approver2ID := uuid.MustParse(UserApprover2ID)
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		 ON CONFLICT (report_id) DO NOTHING`,
		uuid.MustParse(ReportApprovedByApprover2ID), tenantAID, memberID,
		"テスト承認済みレポート（第二Approver処理）", periodStart, periodEnd, string(domain.ReportStatusApproved), 0,
		memberID, ts202603,
		approver2ID, ts202603,
		now, now,
	); err != nil {
		return fmt.Errorf("seed: レポート挿入失敗 [%s]: %w", ReportApprovedByApprover2ID, err)
	}

	return nil
}
