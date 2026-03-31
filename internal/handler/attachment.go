package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// AttachmentHandler handles attachment endpoints.
type AttachmentHandler struct {
	svc service.AttachmentService
}

// NewAttachmentHandler constructs an AttachmentHandler.
func NewAttachmentHandler(svc service.AttachmentService) *AttachmentHandler {
	return &AttachmentHandler{svc: svc}
}

// UploadAttachment handles POST /api/reports/{id}/items/{itemId}/attachments.
func (h *AttachmentHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListAttachments handles GET /api/reports/{id}/items/{itemId}/attachments.
func (h *AttachmentHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetAttachmentDownload handles GET /api/reports/{id}/items/{itemId}/attachments/{attId}.
func (h *AttachmentHandler) GetAttachmentDownload(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteAttachment handles DELETE /api/reports/{id}/items/{itemId}/attachments/{attId}.
func (h *AttachmentHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
