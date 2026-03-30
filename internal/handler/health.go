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
	Checks map[string]string `json:"checks"`
}

// NewHealthHandler returns an http.HandlerFunc that reports application health.
// It pings the database with a 5-second timeout and reflects the result in the response.
func NewHealthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		dbStatus := "ok"
		if err := pool.Ping(ctx); err != nil {
			dbStatus = "error"
		}

		resp := healthResponse{
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
