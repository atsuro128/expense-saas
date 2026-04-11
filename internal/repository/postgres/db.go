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

// execer は ctx に格納された接続をバックエンドとする sqlcgen.DBTX を返す。
// sqlcgen に対応クエリがない場合の raw SQL 実行に使用する。
// 優先順位: tx（トランザクション） → conn（コンテキスト注入済みコネクション） → pool（フォールバック）。
func execer(ctx context.Context, pool *pgxpool.Pool) sqlcgen.DBTX {
	if tx := middleware.GetTx(ctx); tx != nil {
		return tx
	}
	if conn := middleware.GetConn(ctx); conn != nil {
		return conn
	}
	return pool
}
