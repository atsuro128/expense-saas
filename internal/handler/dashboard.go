package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// DashboardHandler handles the dashboard endpoint.
type DashboardHandler struct {
	svc service.DashboardService
}

// NewDashboardHandler constructs a DashboardHandler.
func NewDashboardHandler(svc service.DashboardService) *DashboardHandler {
	return &DashboardHandler{svc: svc}
}

// GetDashboard handles GET /api/dashboard.
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
