package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// ItemHandler handles expense item endpoints.
type ItemHandler struct {
	svc service.ItemService
}

// NewItemHandler constructs an ItemHandler.
func NewItemHandler(svc service.ItemService) *ItemHandler {
	return &ItemHandler{svc: svc}
}

// CreateItem handles POST /api/reports/{id}/items.
func (h *ItemHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// UpdateItem handles PUT /api/reports/{id}/items/{itemId}.
func (h *ItemHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteItem handles DELETE /api/reports/{id}/items/{itemId}.
func (h *ItemHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
