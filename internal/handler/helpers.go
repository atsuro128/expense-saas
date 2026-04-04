package handler

import (
	"net/http"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
)

// actorFromRequest は Auth および TenantContext middleware がセットしたコンテキスト値から
// domain.Actor を生成して返します。
// 必須値が存在しないか不正な形式の場合は false を返します。
func actorFromRequest(r *http.Request) (domain.Actor, bool) {
	userIDStr := middleware.GetUserID(r.Context())
	tenantIDStr := middleware.GetTenantID(r.Context())
	roleStr := middleware.GetRole(r.Context())

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return domain.Actor{}, false
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return domain.Actor{}, false
	}

	role := domain.Role(roleStr)
	if !role.IsValid() {
		return domain.Actor{}, false
	}

	return domain.Actor{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
	}, true
}
