package testutil

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultTestDatabaseURL = "postgresql://testuser:testpass@localhost:5433/expense_test"

// SetupTestDB creates and returns a pgxpool.Pool connected to the test database.
// The connection URL is read from TEST_DATABASE_URL env var, defaulting to localhost:5433.
// The pool is automatically closed via t.Cleanup.
func SetupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultTestDatabaseURL
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("testutil: failed to create test DB pool: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("testutil: failed to ping test DB: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// CleanupTables truncates all application tables in FK dependency order.
// It acquires a direct owner-role connection (TEST_DATABASE_URL) so that RLS is bypassed.
func CleanupTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	// Truncate in reverse FK dependency order so CASCADE handles child rows.
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

// SetTenantContext acquires a dedicated connection from pool, sets the RLS tenant parameter,
// and returns the enriched context, the acquired connection, and a cleanup func.
// The caller must invoke the cleanup func (typically via defer) to release the connection.
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
