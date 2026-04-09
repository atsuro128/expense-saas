package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
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
// クエリパラメータ: status, from, to, page, per_page
func (h *ReportHandler) ListMyReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	params, err := parseReportListParams(r)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", err.Error())
		return
	}

	reports, pagination, err := h.svc.ListMyReports(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       reports,
		"pagination": pagination,
	})
}

// ListAllReports は GET /api/reports/all を処理します。
// Admin / Accounting 専用。テナント全レポートを返します。
func (h *ReportHandler) ListAllReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	// RBAC は middleware で検証済みだが、ここで追加チェックする。
	if actor.Role != domain.RoleAdmin && actor.Role != domain.RoleAccounting {
		middleware.RespondError(w, http.StatusForbidden, "FORBIDDEN", "forbidden")
		return
	}

	params, err := parseReportListParams(r)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", err.Error())
		return
	}

	// submitter_id フィルタを取得する。
	if submitterIDStr := r.URL.Query().Get("submitter_id"); submitterIDStr != "" {
		sid, err := uuid.Parse(submitterIDStr)
		if err != nil {
			middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid submitter_id")
			return
		}
		params.SubmitterID = &sid
	}

	reports, pagination, err := h.svc.ListAllReports(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       reports,
		"pagination": pagination,
	})
}

// createReportRequest は POST /api/reports のリクエストボディを表します。
type createReportRequest struct {
	Title             string  `json:"title"`
	PeriodStart       string  `json:"period_start"`
	PeriodEnd         string  `json:"period_end"`
	ReferenceReportID *string `json:"reference_report_id"`
}

// CreateReport は POST /api/reports を処理します。
func (h *ReportHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	var req createReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	// バリデーション。
	if req.Title == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "title is required")
		return
	}

	periodStart, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid period_start format (YYYY-MM-DD)")
		return
	}

	periodEnd, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid period_end format (YYYY-MM-DD)")
		return
	}

	if periodStart.After(periodEnd) {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "period_start must be before or equal to period_end")
		return
	}

	params := service.CreateReportParams{
		Title:       req.Title,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}

	if req.ReferenceReportID != nil {
		refID, err := uuid.Parse(*req.ReferenceReportID)
		if err != nil {
			middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid reference_report_id")
			return
		}
		params.ReferenceReportID = &refID
	}

	detail, err := h.svc.CreateReport(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusCreated, map[string]interface{}{"data": detail})
}

// GetReport は GET /api/reports/{id} を処理します。
func (h *ReportHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := parseUUIDParam(r, "id")
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	detail, err := h.svc.GetReport(r.Context(), actor, reportID)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// updateReportRequest は PUT /api/reports/{id} のリクエストボディを表します。
type updateReportRequest struct {
	Title       string `json:"title"`
	PeriodStart string `json:"period_start"`
	PeriodEnd   string `json:"period_end"`
	UpdatedAt   string `json:"updated_at"`
}

// UpdateReport は PUT /api/reports/{id} を処理します。
func (h *ReportHandler) UpdateReport(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := parseUUIDParam(r, "id")
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req updateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.Title == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "title is required")
		return
	}

	periodStart, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid period_start format")
		return
	}

	periodEnd, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid period_end format")
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid updated_at format")
		return
	}

	params := service.UpdateReportParams{
		Title:       req.Title,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		UpdatedAt:   updatedAt.UTC(),
	}

	detail, err := h.svc.UpdateReport(r.Context(), actor, reportID, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// DeleteReport は DELETE /api/reports/{id} を処理します。
func (h *ReportHandler) DeleteReport(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := parseUUIDParam(r, "id")
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	if err := h.svc.DeleteReport(r.Context(), actor, reportID); err != nil {
		respondDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// submitReportRequest は POST /api/reports/{id}/submit のリクエストボディを表します。
type submitReportRequest struct {
	UpdatedAt string `json:"updated_at"`
}

// SubmitReport は POST /api/reports/{id}/submit を処理します。
func (h *ReportHandler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := parseUUIDParam(r, "id")
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req submitReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid updated_at format")
		return
	}

	detail, err := h.svc.SubmitReport(r.Context(), actor, reportID, updatedAt.UTC())
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// --- プライベートヘルパー ---

// parseUUIDParam は chi ルートパラメータを UUID にパースします。
func parseUUIDParam(r *http.Request, paramName string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, paramName))
}

// parseReportListParams はクエリパラメータから ReportListParams を構築します。
func parseReportListParams(r *http.Request) (domain.ReportListParams, error) {
	q := r.URL.Query()
	params := domain.ReportListParams{
		Page:    1,
		PerPage: 20,
	}

	if pageStr := q.Get("page"); pageStr != "" {
		var page int
		if _, err := parseIntQuery(pageStr, &page); err != nil || page < 1 {
			return params, domain.ErrInvalidPeriod
		}
		params.Page = page
	}

	if perPageStr := q.Get("per_page"); perPageStr != "" {
		var perPage int
		if _, err := parseIntQuery(perPageStr, &perPage); err != nil || perPage < 1 {
			return params, domain.ErrInvalidPeriod
		}
		params.PerPage = perPage
	}

	if statusStr := q.Get("status"); statusStr != "" {
		s := domain.ReportStatus(statusStr)
		if !s.IsValid() {
			return params, domain.ErrInvalidPeriod
		}
		params.Status = &s
	}

	if fromStr := q.Get("from"); fromStr != "" {
		t, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			return params, domain.ErrInvalidPeriod
		}
		params.From = &t
	}

	if toStr := q.Get("to"); toStr != "" {
		t, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			return params, domain.ErrInvalidPeriod
		}
		params.To = &t
	}

	return params, nil
}

// parseIntQuery は文字列を int にパースします。
func parseIntQuery(s string, out *int) (int, error) {
	var v int
	_, err := fmt.Sscanf(s, "%d", &v)
	if err != nil {
		return 0, err
	}
	*out = v
	return v, nil
}
