package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// ItemHandler は経費明細エンドポイントの handler です。
type ItemHandler struct {
	svc service.ItemService
}

// NewItemHandler は ItemHandler を生成して返します。
func NewItemHandler(svc service.ItemService) *ItemHandler {
	return &ItemHandler{svc: svc}
}

// CreateItem は POST /api/reports/{id}/items を処理します。
func (h *ItemHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// UpdateItem は PUT /api/reports/{id}/items/{itemId} を処理します。
func (h *ItemHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteItem は DELETE /api/reports/{id}/items/{itemId} を処理します。
func (h *ItemHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
