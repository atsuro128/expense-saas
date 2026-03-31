package handler

import (
	"net/http"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
)

// actorFromRequest constructs a domain.Actor from context values set by the
// Auth and TenantContext middlewares.
// Returns false when any required value is missing or malformed.
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
