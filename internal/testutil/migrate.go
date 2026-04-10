package testutil

import (
	"errors"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations は db/migrations/ にある未適用のマイグレーションを指定の DB URL に適用する。
// ErrNoChange は無視する（冪等）。
func RunMigrations(t *testing.T, dbURL string) {
	t.Helper()

	// テストの実行ディレクトリに依存しないパス解決
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("testutil: runtime.Caller failed")
	}
	root := filepath.Join(filepath.Dir(thisFile), "..", "..")
	source := "file://" + filepath.Join(root, "db", "migrations")

	m, err := migrate.New(source, dbURL)
	if err != nil {
		t.Fatalf("testutil: failed to create migrator: %v", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("testutil: failed to run migrations: %v", err)
	}
}
