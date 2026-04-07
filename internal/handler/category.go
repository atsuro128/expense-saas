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
func (h *CategoryHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
