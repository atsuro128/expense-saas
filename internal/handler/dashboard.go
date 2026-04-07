package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// DashboardHandler はダッシュボードエンドポイントの handler です。
type DashboardHandler struct {
	svc service.DashboardService
}

// NewDashboardHandler は DashboardHandler を生成して返します。
func NewDashboardHandler(svc service.DashboardService) *DashboardHandler {
	return &DashboardHandler{svc: svc}
}

// GetDashboard は GET /api/dashboard を処理します。
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
