package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// WorkflowHandler handles workflow (approval / payment) endpoints.
type WorkflowHandler struct {
	svc service.WorkflowService
}

// NewWorkflowHandler constructs a WorkflowHandler.
func NewWorkflowHandler(svc service.WorkflowService) *WorkflowHandler {
	return &WorkflowHandler{svc: svc}
}

// ListPendingReports handles GET /api/workflow/pending.
func (h *WorkflowHandler) ListPendingReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ApproveReport handles POST /api/workflow/{id}/approve.
func (h *WorkflowHandler) ApproveReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RejectReport handles POST /api/workflow/{id}/reject.
func (h *WorkflowHandler) RejectReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListPayableReports handles GET /api/workflow/payable.
func (h *WorkflowHandler) ListPayableReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// MarkReportAsPaid handles POST /api/workflow/{id}/pay.
func (h *WorkflowHandler) MarkReportAsPaid(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
