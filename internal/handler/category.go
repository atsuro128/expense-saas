package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// CategoryHandler はカテゴリエンドポイントの handler です。
type CategoryHandler struct {
	svc service.CategoryService
}

// NewCategoryHandler は CategoryHandler を生成して返します。
func NewCategoryHandler(svc service.CategoryService) *CategoryHandler {
	return &CategoryHandler{svc: svc}
}

// ListCategories は GET /api/categories を処理します。
// 操作者のテナントで参照可能な有効カテゴリを返します。
func (h *CategoryHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	categories, err := h.svc.ListCategories(r.Context(), actor)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data": categories,
	})
}
