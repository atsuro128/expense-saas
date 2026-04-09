package testutil

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultTestDatabaseURL = "postgresql://testuser:testpass@localhost:5433/expense_test"

// SetupTestDB はテストデータベースに接続した pgxpool.Pool を生成して返す。
// 接続 URL は TEST_DATABASE_URL 環境変数から読み込み、未設定の場合は localhost:5433 を使用する。
// pool は t.Cleanup で自動的にクローズされる。
func SetupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultTestDatabaseURL
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("testutil: DB 接続プールの作成に失敗しました: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("testutil: DB への疎通確認に失敗しました: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// CleanupTables は外部キー依存順にすべてのアプリケーションテーブルを TRUNCATE する。
// RLS をバイパスするため、オーナーロールの直接コネクション（TEST_DATABASE_URL）を使用する。
func CleanupTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	// CASCADE で子レコードが処理されるよう、FK 依存の逆順で TRUNCATE する。
	tables := []string{
		"password_reset_tokens",
		"refresh_tokens",
		"attachments",
		"expense_items",
		"expense_reports",
		"tenant_memberships",
		"users",
		"tenants",
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("testutil: failed to acquire connection for cleanup: %v", err)
	}
	defer conn.Release()

	for _, tbl := range tables {
		if _, err := conn.Exec(ctx, "TRUNCATE TABLE "+tbl+" CASCADE"); err != nil {
			t.Fatalf("testutil: failed to truncate table %s: %v", tbl, err)
		}
	}
}

// SetTenantContext は pool から専用コネクションを取得し、RLS のテナントパラメータを設定した上で、
// 拡張済みコンテキスト・取得したコネクション・クリーンアップ関数を返す。
// 呼び出し元は（通常 defer で）クリーンアップ関数を呼び出してコネクションを解放する必要がある。
func SetTenantContext(t *testing.T, ctx context.Context, pool *pgxpool.Pool, tenantID string) (context.Context, *pgxpool.Conn, func()) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("SetTenantContext: failed to acquire connection: %v", err)
	}

	if _, err := conn.Exec(ctx, "SELECT set_config('app.current_tenant', $1, true)", tenantID); err != nil {
		conn.Release()
		t.Fatalf("SetTenantContext: failed to set tenant context: %v", err)
	}

	cleanup := func() {
		conn.Release()
	}
	return ctx, conn, cleanup
}
