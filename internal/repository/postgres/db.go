package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/middleware"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

// queries は ctx に格納されたテナントコンテキスト用コネクションをバックエンドとする sqlcgen.Queries を返す。
// コネクションが存在しない場合（未認証パスなど）は、指定された pool にフォールバックする。
func queries(ctx context.Context, pool *pgxpool.Pool) *sqlcgen.Queries {
	if conn := middleware.GetConn(ctx); conn != nil {
		return sqlcgen.New(conn)
	}
	return sqlcgen.New(pool)
}
