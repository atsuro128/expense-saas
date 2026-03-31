package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// AuthHandler handles authentication-related endpoints.
type AuthHandler struct {
	svc service.AuthService
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(svc service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// Signup handles POST /api/auth/signup.
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// Login handles POST /api/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RefreshToken handles POST /api/auth/refresh.
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// Logout handles POST /api/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetMe handles GET /api/auth/me.
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RequestPasswordReset handles POST /api/auth/password-reset.
func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ExecutePasswordReset handles PUT /api/auth/password-reset/{token}.
func (h *AuthHandler) ExecutePasswordReset(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
