package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/middleware"
)

type healthResponse struct {
	Status string            `json:"status"`
	Uptime string            `json:"uptime"`
	Checks map[string]string `json:"checks"`
}

// NewHealthHandler はアプリケーションのヘルスチェックを行う http.HandlerFunc を返します。
// データベースに対して 5 秒のタイムアウトで ping を実行し、その結果をレスポンスに反映します。
// startedAt はアプリケーション起動時刻で、稼働時間（Uptime）の算出に使用します。
func NewHealthHandler(pool *pgxpool.Pool, startedAt time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		dbStatus := "ok"
		if err := pool.Ping(ctx); err != nil {
			dbStatus = "error"
		}

		resp := healthResponse{
			Uptime: time.Since(startedAt).String(),
			Checks: map[string]string{
				"database": dbStatus,
			},
		}

		if dbStatus == "ok" {
			resp.Status = "ok"
			middleware.RespondJSON(w, http.StatusOK, resp)
		} else {
			resp.Status = "degraded"
			middleware.RespondJSON(w, http.StatusServiceUnavailable, resp)
		}
	}
}
