package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// WorkflowHandler はワークフロー（承認・支払）エンドポイントの handler です。
type WorkflowHandler struct {
	svc service.WorkflowService
}

// NewWorkflowHandler は WorkflowHandler を生成して返します。
func NewWorkflowHandler(svc service.WorkflowService) *WorkflowHandler {
	return &WorkflowHandler{svc: svc}
}

// ListPendingReports は GET /api/workflow/pending を処理します。
func (h *WorkflowHandler) ListPendingReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ApproveReport は POST /api/workflow/{id}/approve を処理します。
func (h *WorkflowHandler) ApproveReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// RejectReport は POST /api/workflow/{id}/reject を処理します。
func (h *WorkflowHandler) RejectReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListPayableReports は GET /api/workflow/payable を処理します。
func (h *WorkflowHandler) ListPayableReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// MarkReportAsPaid は POST /api/workflow/{id}/pay を処理します。
func (h *WorkflowHandler) MarkReportAsPaid(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
