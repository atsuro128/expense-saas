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

	// 2 ヶ月以上に分散していることを確認する（当月・前月・前々月の 3 ヶ月を期待）。
	if len(months) < 2 {
		t.Errorf("paid レポートの期間分散が不十分: %d ヶ月のみ (want >= 2)", len(months))
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
