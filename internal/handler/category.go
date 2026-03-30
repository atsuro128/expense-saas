package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// CategoryHandler handles the category endpoint.
type CategoryHandler struct {
	svc service.CategoryService
}

// NewCategoryHandler constructs a CategoryHandler.
func NewCategoryHandler(svc service.CategoryService) *CategoryHandler {
	return &CategoryHandler{svc: svc}
}

// ListCategories handles GET /api/categories.
func (h *CategoryHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
