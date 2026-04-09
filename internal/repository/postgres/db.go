package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/middleware"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

// queries は ctx に格納されたコネクションをバックエンドとする sqlcgen.Queries を返す。
// 優先順位: tx（トランザクション） → conn（テナントコンテキスト用コネクション） → pool（フォールバック）。
func queries(ctx context.Context, pool *pgxpool.Pool) *sqlcgen.Queries {
	if tx := middleware.GetTx(ctx); tx != nil {
		return sqlcgen.New(tx)
	}
	if conn := middleware.GetConn(ctx); conn != nil {
		return sqlcgen.New(conn)
	}
	return sqlcgen.New(pool)
}
