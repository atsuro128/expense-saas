package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// AuthHandler は認証関連エンドポイントの handler です。
type AuthHandler struct {
	svc service.AuthService
}

// NewAuthHandler は AuthHandler を生成して返します。
func NewAuthHandler(svc service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// Signup は POST /api/auth/signup を処理します。
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// Login は POST /api/auth/login を処理します。
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RefreshToken は POST /api/auth/refresh を処理します。
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// Logout は POST /api/auth/logout を処理します。
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetMe は GET /api/auth/me を処理します。
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RequestPasswordReset は POST /api/auth/password-reset を処理します。
func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ExecutePasswordReset は PUT /api/auth/password-reset/{token} を処理します。
func (h *AuthHandler) ExecutePasswordReset(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
