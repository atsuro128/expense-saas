// Package seed_test は seed.Run の統合テストを提供する。
// issue-087 対応: paid レポートの件数・期間分散・total_amount > 0・paid_at NOT NULL を検証する。
package seed_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/seed"
	"expense-saas/internal/testutil"
)

// setupSeedTest はテスト DB を準備し、標準フィクスチャを投入する。
// CleanupTables → seed.Run の順で実行し、冪等性を担保する。
func setupSeedTest(t *testing.T) *pgxpool.Pool {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)

	// seed.Run を直接呼び出す（S3 クライアントは nil でスキップ）。
	if err := seed.Run(context.Background(), pool, nil); err != nil {
		t.Fatalf("seed.Run に失敗しました: %v", err)
	}

	return pool
}

// TestSeed_PaidReportCount は paid ステータスのレポートが 3 件以上存在することを検証する。
// issue-087 問題①: paid レポートが直近 3 ヶ月（当月・前月・前々月）に分散して存在すること。
func TestSeed_PaidReportCount(t *testing.T) {
	pool := setupSeedTest(t)

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}
	defer conn.Release()

	var count int
	if err := conn.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM expense_reports WHERE status = 'paid' AND deleted_at IS NULL`,
	).Scan(&count); err != nil {
		t.Fatalf("paid 件数取得失敗: %v", err)
	}

	// 直近 3 ヶ月（当月・前月・前々月）に 1 件ずつ、合計 3 件以上を期待する。
	if count < 3 {
		t.Errorf("paid レポートが 3 件未満: got %d, want >= 3", count)
	}
}

// TestSeed_PaidReportPeriodDistribution は paid レポートが複数の月に分散していることを検証する。
// issue-087 問題①: 直近 3 ヶ月（当月・前月・前々月）に分散して存在すること。
func TestSeed_PaidReportPeriodDistribution(t *testing.T) {
	pool := setupSeedTest(t)

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}
	defer conn.Release()

	// paid レポートの period_start の月別分布を取得する。
	rows, err := conn.Query(context.Background(),
		`SELECT DISTINCT DATE_TRUNC('month', period_start)::date
		 FROM expense_reports
		 WHERE status = 'paid' AND deleted_at IS NULL
		 ORDER BY 1`,
	)
	if err != nil {
		t.Fatalf("paid 分布クエリ失敗: %v", err)
	}
	defer rows.Close()

	months := make([]time.Time, 0)
	for rows.Next() {
		var m time.Time
		if err := rows.Scan(&m); err != nil {
			t.Fatalf("行読み取り失敗: %v", err)
		}
		months = append(months, m)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err(): %v", err)
	}

	// issue-087 完了条件: 当月・前月・前々月の 3 ヶ月分が必ず含まれていること。
	now := time.Now().UTC()
	curMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	prevMonth := curMonth.AddDate(0, -1, 0)
	prev2Month := curMonth.AddDate(0, -2, 0)

	monthSet := make(map[time.Time]bool, len(months))
	for _, m := range months {
		monthSet[m] = true
	}

	for _, want := range []time.Time{prev2Month, prevMonth, curMonth} {
		if !monthSet[want] {
			t.Errorf("paid レポートに %s の月が含まれていません (got months=%v)", want.Format("2006-01"), months)
		}
	}
}

// TestSeed_PaidReportTotalAmountPositive は全 paid レポートの total_amount > 0 を検証する。
// issue-087 問題②: total_amount が 0 のままになっている問題を修正したことを確認する。
func TestSeed_PaidReportTotalAmountPositive(t *testing.T) {
	pool := setupSeedTest(t)

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}
	defer conn.Release()

	var zeroCount int
	if err := conn.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM expense_reports
		 WHERE status = 'paid' AND total_amount = 0 AND deleted_at IS NULL`,
	).Scan(&zeroCount); err != nil {
		t.Fatalf("total_amount=0 の件数取得失敗: %v", err)
	}

	if zeroCount > 0 {
		t.Errorf("paid レポートに total_amount = 0 のものが %d 件存在します（0 件であるべき）", zeroCount)
	}
}

// TestSeed_PaidReportPaidAtNotNull は全 paid レポートの paid_at が NULL でないことを検証する。
// issue-087 問題③: 状態タイムスタンプが NULL のままになっている問題を修正したことを確認する。
func TestSeed_PaidReportPaidAtNotNull(t *testing.T) {
	pool := setupSeedTest(t)

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}
	defer conn.Release()

	var nullCount int
	if err := conn.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM expense_reports
		 WHERE status = 'paid' AND paid_at IS NULL AND deleted_at IS NULL`,
	).Scan(&nullCount); err != nil {
		t.Fatalf("paid_at IS NULL の件数取得失敗: %v", err)
	}

	if nullCount > 0 {
		t.Errorf("paid レポートに paid_at = NULL のものが %d 件存在します（0 件であるべき）", nullCount)
	}
}

// TestSeed_ReportTenantBApproved_BackfillExistingRow は、旧 seed 済み環境（approved_by / approved_at が NULL）
// で seed.Run を再実行した場合に、ReportTenantBApprovedID の approved_by / approved_at が
// UserApproverBID / now で補完されることを検証する。
// issue-166 regression テスト: 補完 UPDATE が削除されると FAIL する。
func TestSeed_ReportTenantBApproved_BackfillExistingRow(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)

	ctx := context.Background()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}

	// 旧 seed 相当の状態を作る。
	// テナント B / ユーザー / メンバーシップのみを最小限投入し、
	// ReportTenantBApprovedID は approved_by / approved_at を NULL のまま INSERT する。
	// （ON CONFLICT DO NOTHING で seed.Run がスキップするよう事前に行を用意する）

	now := time.Now().UTC()
	periodStart := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	ts202603 := time.Date(2026, 3, 15, 10, 0, 0, 0, time.UTC)

	// テナント B 投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO tenants (tenant_id, company_name, created_at, updated_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tenant_id) DO NOTHING`,
		seed.TenantBID, "Test Company B", now, now,
	); err != nil {
		conn.Release()
		t.Fatalf("テナント B 挿入失敗: %v", err)
	}

	// テナント B メンバー（UserMemberBID）投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id) DO NOTHING`,
		seed.UserMemberBID, "test-member-b@example.com", "Test Member B", "dummy_hash", now, now,
	); err != nil {
		conn.Release()
		t.Fatalf("ユーザー（MemberB）挿入失敗: %v", err)
	}

	// テナント B メンバーシップ投入。
	if _, err := conn.Exec(ctx,
		`INSERT INTO tenant_memberships (tenant_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tenant_id, user_id) DO NOTHING`,
		seed.TenantBID, seed.UserMemberBID, "member", now, now,
	); err != nil {
		conn.Release()
		t.Fatalf("メンバーシップ（MemberB）挿入失敗: %v", err)
	}

	// 旧 seed 相当: ReportTenantBApprovedID を approved_by / approved_at = NULL で投入する。
	// approved_by 列を指定しないことで NULL のまま挿入する（旧 seed の動作を模倣）。
	if _, err := conn.Exec(ctx,
		`INSERT INTO expense_reports
		 (report_id, tenant_id, user_id, title, period_start, period_end, status, total_amount,
		  submitted_by, submitted_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 ON CONFLICT (report_id) DO NOTHING`,
		seed.ReportTenantBApprovedID, seed.TenantBID, seed.UserMemberBID,
		"テナントB承認済みレポート", periodStart, periodEnd, "approved", 0,
		seed.UserMemberBID, ts202603,
		now, now,
	); err != nil {
		conn.Release()
		t.Fatalf("旧 seed 相当の ReportTenantBApprovedID 挿入失敗: %v", err)
	}

	// 挿入直後に approved_by が NULL であることを確認する（旧 seed 状態の前提検証）。
	var approvedByBefore *string
	if err := conn.QueryRow(ctx,
		`SELECT approved_by::text FROM expense_reports WHERE report_id = $1`,
		seed.ReportTenantBApprovedID,
	).Scan(&approvedByBefore); err != nil {
		conn.Release()
		t.Fatalf("approved_by 初期状態取得失敗: %v", err)
	}
	if approvedByBefore != nil {
		conn.Release()
		t.Fatalf("テスト前提条件違反: approved_by が NULL であるべきですが %s が設定されています", *approvedByBefore)
	}

	// レポート件数（seed.Run 前）を記録する。
	var countBefore int
	if err := conn.QueryRow(ctx,
		`SELECT COUNT(*) FROM expense_reports WHERE deleted_at IS NULL`,
	).Scan(&countBefore); err != nil {
		conn.Release()
		t.Fatalf("seed.Run 前のレポート件数取得失敗: %v", err)
	}

	conn.Release()

	// seed.Run を実行する（S3 クライアントは nil でスキップ）。
	if err := seed.Run(ctx, pool, nil); err != nil {
		t.Fatalf("seed.Run に失敗しました: %v", err)
	}

	// 検証用コネクションを取得する。
	conn2, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続取得失敗（検証用）: %v", err)
	}
	defer conn2.Release()

	// アサーション 1: approved_by が UserApproverBID に補完されていること。
	var approvedByAfter *string
	var approvedAtAfter *time.Time
	if err := conn2.QueryRow(ctx,
		`SELECT approved_by::text, approved_at FROM expense_reports WHERE report_id = $1`,
		seed.ReportTenantBApprovedID,
	).Scan(&approvedByAfter, &approvedAtAfter); err != nil {
		t.Fatalf("seed.Run 後の approved_by / approved_at 取得失敗: %v", err)
	}

	if approvedByAfter == nil {
		t.Errorf("approved_by が補完されていません: NULL のままです（%s に補完されるべき）", seed.UserApproverBID)
	} else if *approvedByAfter != seed.UserApproverBID {
		t.Errorf("approved_by の補完値が不正です: got=%s, want=%s", *approvedByAfter, seed.UserApproverBID)
	}

	// アサーション 2: approved_at が NOT NULL に補完されていること。
	if approvedAtAfter == nil {
		t.Errorf("approved_at が補完されていません: NULL のままです（NOT NULL に補完されるべき）")
	}

	// アサーション 3: レポート件数が増えていないこと（補完であって新規追加ではない）。
	var countAfter int
	if err := conn2.QueryRow(ctx,
		`SELECT COUNT(*) FROM expense_reports WHERE deleted_at IS NULL`,
	).Scan(&countAfter); err != nil {
		t.Fatalf("seed.Run 後のレポート件数取得失敗: %v", err)
	}

	if countAfter < countBefore {
		// seed.Run で他のフィクスチャが新規追加されるため countAfter >= countBefore が正常。
		// countAfter < countBefore は行が削除されるケースであり異常。
		t.Errorf("seed.Run 後にレポート件数が減少しました: before=%d, after=%d", countBefore, countAfter)
	}

	// より厳密な確認: ReportTenantBApprovedID の report_id に対応する行が 1 件だけ存在すること。
	var reportCount int
	if err := conn2.QueryRow(ctx,
		`SELECT COUNT(*) FROM expense_reports WHERE report_id = $1`,
		seed.ReportTenantBApprovedID,
	).Scan(&reportCount); err != nil {
		t.Fatalf("ReportTenantBApprovedID の件数取得失敗: %v", err)
	}
	if reportCount != 1 {
		t.Errorf("ReportTenantBApprovedID のレポートが %d 件存在します（1 件であるべき）", reportCount)
	}
}

// TestSeed_Idempotent は seed.Run を 2 回実行しても重複が発生しないことを検証する。
// 冪等性: ON CONFLICT DO NOTHING により再実行でデータが増えないこと。
func TestSeed_Idempotent(t *testing.T) {
	pool := setupSeedTest(t)

	// 1 回目の seed.Run は setupSeedTest 内で実行済み。件数を記録する。
	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗: %v", err)
	}

	var countBefore int
	if err := conn.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM expense_reports WHERE deleted_at IS NULL`,
	).Scan(&countBefore); err != nil {
		conn.Release()
		t.Fatalf("初回件数取得失敗: %v", err)
	}
	conn.Release()

	// 2 回目の seed.Run を実行する。
	if err := seed.Run(context.Background(), pool, nil); err != nil {
		t.Fatalf("2 回目の seed.Run に失敗しました: %v", err)
	}

	conn2, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("DB 接続取得失敗（2 回目後）: %v", err)
	}
	defer conn2.Release()

	var countAfter int
	if err := conn2.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM expense_reports WHERE deleted_at IS NULL`,
	).Scan(&countAfter); err != nil {
		t.Fatalf("2 回目後件数取得失敗: %v", err)
	}

	if countAfter != countBefore {
		t.Errorf("seed 2 回実行後にレポート件数が変化しました: before=%d, after=%d（冪等性違反）", countBefore, countAfter)
	}
}
