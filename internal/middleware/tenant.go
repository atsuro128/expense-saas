package middleware

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantContext はデータベース接続を取得し、トランザクションを開始したうえで
// RLS テナントパラメータをセットし、接続をリクエストコンテキストに格納する middleware を返します。
// ステータスコードが 400 未満の場合はコミット、それ以外はロールバックします。
func TenantContext(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			tenantID := GetTenantID(ctx)
			if tenantID == "" {
				RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
				return
			}

			conn, err := pool.Acquire(ctx)
			if err != nil {
				slog.Error("failed to acquire database connection", "error", err)
				RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error")
				return
			}

			// panic が発生した場合でも接続を必ず解放する。
			committed := false
			defer func() {
				p := recover()
				if !committed {
					if _, rbErr := conn.Exec(ctx, "ROLLBACK"); rbErr != nil {
						slog.Error("failed to rollback transaction", "error", rbErr)
					}
				}
				conn.Release()
				if p != nil {
					panic(p)
				}
			}()

			if _, err = conn.Exec(ctx, "BEGIN"); err != nil {
				slog.Error("failed to begin transaction", "error", err)
				RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error")
				return
			}

			if _, err = conn.Exec(ctx, "SELECT set_config('app.current_tenant', $1, true)", tenantID); err != nil {
				slog.Error("failed to set tenant context", "error", err)
				RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error")
				return
			}

			ctx = SetConn(ctx, conn)

			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(wrapped, r.WithContext(ctx))

			if wrapped.status < 400 {
				if _, err = conn.Exec(ctx, "COMMIT"); err != nil {
					slog.Error("failed to commit transaction", "error", err)
				} else {
					committed = true
				}
			}
		})
	}
}
