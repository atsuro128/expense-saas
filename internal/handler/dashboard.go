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
// アクターのロールに応じたダッシュボードデータを JSON で返します。
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "認証情報が不正です")
		return
	}

	data, err := h.svc.GetDashboard(r.Context(), actor)
	if err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data": data,
	})
}
