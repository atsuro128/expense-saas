package testutil

import (
	"errors"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations applies all pending migrations from db/migrations/ to the
// given database URL. ErrNoChange is ignored (idempotent).
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
