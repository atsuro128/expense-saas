package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// TenantHandler はテナント管理エンドポイントの handler です。
type TenantHandler struct {
	svc service.TenantService
}

// NewTenantHandler は TenantHandler を生成して返します。
func NewTenantHandler(svc service.TenantService) *TenantHandler {
	return &TenantHandler{svc: svc}
}

// GetTenant は GET /api/tenant を処理します。
func (h *TenantHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListTenantMembers は GET /api/tenant/members を処理します。
func (h *TenantHandler) ListTenantMembers(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
