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

// validReportStatuses は ListAllReports で受け付けるステータス値の許可リスト。
var validReportStatuses = map[string]struct{}{
	"draft":     {},
	"submitted": {},
	"approved":  {},
	"rejected":  {},
	"paid":      {},
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

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	// page のパースとバリデーション。
	page := 0
	if pageStr := q.Get("page"); pageStr != "" {
		v, err := strconv.Atoi(pageStr)
		if err != nil || v <= 0 {
			details = append(details, middleware.ValidationError{
				Field:   "page",
				Message: "page は正の整数でなければなりません",
			})
		} else {
			page = v
		}
	}

	// per_page のパースとバリデーション（上限 100）。
	perPage := 0
	if perPageStr := q.Get("per_page"); perPageStr != "" {
		v, err := strconv.Atoi(perPageStr)
		if err != nil || v <= 0 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page は正の整数でなければなりません",
			})
		} else if v > 100 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page の上限は 100 です",
			})
		} else {
			perPage = v
		}
	}

	// status のバリデーション（許可値リスト）。
	var statusParam *domain.ReportStatus
	if s := q.Get("status"); s != "" {
		if _, ok := validReportStatuses[s]; !ok {
			details = append(details, middleware.ValidationError{
				Field:   "status",
				Message: "status は draft, submitted, approved, rejected, paid のいずれかでなければなりません",
			})
		} else {
			rs := domain.ReportStatus(s)
			statusParam = &rs
		}
	}

	// submitter_id のバリデーション（UUID 形式）。
	var submitterID *uuid.UUID
	if sid := q.Get("submitter_id"); sid != "" {
		id, err := uuid.Parse(sid)
		if err != nil {
			details = append(details, middleware.ValidationError{
				Field:   "submitter_id",
				Message: "submitter_id は UUID 形式でなければなりません",
			})
		} else {
			submitterID = &id
		}
	}

	// from のバリデーション（YYYY-MM-DD 形式のみ許可）。
	var fromParam *time.Time
	if f := q.Get("from"); f != "" {
		t, err := time.Parse("2006-01-02", f)
		if err != nil {
			details = append(details, middleware.ValidationError{
				Field:   "from",
				Message: "from は YYYY-MM-DD 形式でなければなりません",
			})
		} else {
			fromParam = &t
		}
	}

	// to のバリデーション（YYYY-MM-DD 形式のみ許可）。
	var toParam *time.Time
	if t := q.Get("to"); t != "" {
		parsed, err := time.Parse("2006-01-02", t)
		if err != nil {
			details = append(details, middleware.ValidationError{
				Field:   "to",
				Message: "to は YYYY-MM-DD 形式でなければなりません",
			})
		} else {
			toParam = &parsed
		}
	}

	// バリデーションエラーがあれば 422 を返す。
	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力パラメータに誤りがあります",
				Details: details,
			},
		})
		return
	}

	params := domain.ReportListParams{
		Page:        page,
		PerPage:     perPage,
		Status:      statusParam,
		SubmitterID: submitterID,
		From:        fromParam,
		To:          toParam,
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
