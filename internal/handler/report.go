package handler

import (
	"net/http"

	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// ReportHandler handles expense report endpoints.
type ReportHandler struct {
	svc service.ReportService
}

// NewReportHandler constructs a ReportHandler.
func NewReportHandler(svc service.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

// ListMyReports handles GET /api/reports.
func (h *ReportHandler) ListMyReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListAllReports handles GET /api/reports/all.
func (h *ReportHandler) ListAllReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// CreateReport handles POST /api/reports.
func (h *ReportHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetReport handles GET /api/reports/{id}.
func (h *ReportHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// UpdateReport handles PUT /api/reports/{id}.
func (h *ReportHandler) UpdateReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteReport handles DELETE /api/reports/{id}.
func (h *ReportHandler) DeleteReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// SubmitReport handles POST /api/reports/{id}/submit.
func (h *ReportHandler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
