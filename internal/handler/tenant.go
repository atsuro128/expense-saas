package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// TenantHandler handles tenant management endpoints.
type TenantHandler struct {
	svc service.TenantService
}

// NewTenantHandler constructs a TenantHandler.
func NewTenantHandler(svc service.TenantService) *TenantHandler {
	return &TenantHandler{svc: svc}
}

// GetTenant handles GET /api/tenant.
func (h *TenantHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListTenantMembers handles GET /api/tenant/members.
func (h *TenantHandler) ListTenantMembers(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
