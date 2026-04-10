package handler

import (
	"errors"
	"net/http"

	"expense-saas/internal/domain"
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
// Admin ロールのみ許可。自分のテナント情報を返します。
func (h *TenantHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	info, err := h.svc.GetTenant(r.Context(), actor)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			middleware.RespondError(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", "tenant not found")
			return
		}
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data": info,
	})
}

// ListTenantMembers は GET /api/tenant/members を処理します。
// Admin / Accounting ロールのみ許可。テナントの全メンバーを返します。
func (h *TenantHandler) ListTenantMembers(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	members, err := h.svc.ListTenantMembers(r.Context(), actor)
	if err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data": members,
	})
}
