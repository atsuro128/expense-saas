package testutil

import (
	"errors"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations は db/migrations/ にある未適用のマイグレーションを指定の DB URL に適用する。
// ErrNoChange は無視する（冪等）。
func RunMigrations(t *testing.T, dbURL string) {
	t.Helper()

	m, err := migrate.New("file://db/migrations", dbURL)
	if err != nil {
		t.Fatalf("testutil: failed to create migrator: %v", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("testutil: failed to run migrations: %v", err)
	}
}
