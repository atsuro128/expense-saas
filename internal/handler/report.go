package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// ReportHandler は経費申請エンドポイントの handler です。
type ReportHandler struct {
	svc service.ReportService
}

// NewReportHandler は ReportHandler を生成して返します。
func NewReportHandler(svc service.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

// ListMyReports は GET /api/reports を処理します。
func (h *ReportHandler) ListMyReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// ListAllReports は GET /api/reports/all を処理します。
// Admin / Accounting ロールのみ許可。テナント内の全レポートを一覧取得します。
func (h *ReportHandler) ListAllReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	q := r.URL.Query()

	// page・per_page のパース。
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	params := domain.ReportListParams{
		Page:    page,
		PerPage: perPage,
	}

	// status フィルタのパース。
	if s := q.Get("status"); s != "" {
		rs := domain.ReportStatus(s)
		params.Status = &rs
	}

	// from フィルタのパース（RFC3339 または YYYY-MM-DD）。
	if f := q.Get("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			params.From = &t
		} else if t, err := time.Parse("2006-01-02", f); err == nil {
			params.From = &t
		}
	}

	// to フィルタのパース（RFC3339 または YYYY-MM-DD）。
	if t := q.Get("to"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			params.To = &parsed
		} else if parsed, err := time.Parse("2006-01-02", t); err == nil {
			params.To = &parsed
		}
	}

	// submitter_id フィルタのパース。
	if sid := q.Get("submitter_id"); sid != "" {
		if id, err := uuid.Parse(sid); err == nil {
			params.SubmitterID = &id
		}
	}

	summaries, pagination, err := h.svc.ListAllReports(r.Context(), actor, params)
	if err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       summaries,
		"pagination": pagination,
	})
}

// CreateReport は POST /api/reports を処理します。
func (h *ReportHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// GetReport は GET /api/reports/{id} を処理します。
func (h *ReportHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// UpdateReport は PUT /api/reports/{id} を処理します。
func (h *ReportHandler) UpdateReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// DeleteReport は DELETE /api/reports/{id} を処理します。
func (h *ReportHandler) DeleteReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}

// SubmitReport は POST /api/reports/{id}/submit を処理します。
func (h *ReportHandler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
}
