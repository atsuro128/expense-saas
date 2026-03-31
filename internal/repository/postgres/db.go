package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/middleware"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

// queries returns a sqlcgen.Queries backed by the TenantContext connection stored
// in ctx. When no such connection is present (e.g., unauthenticated paths), it
// falls back to the provided pool.
func queries(ctx context.Context, pool *pgxpool.Pool) *sqlcgen.Queries {
	if conn := middleware.GetConn(ctx); conn != nil {
		return sqlcgen.New(conn)
	}
	return sqlcgen.New(pool)
}
