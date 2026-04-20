package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", nil)
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
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
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       summaries,
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
		var details []middleware.ValidationError
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field != "" {
			details = append(details, middleware.ValidationError{
				Field:   typeErr.Field,
				Message: fmt.Sprintf("%s の型が不正です（期待: %s）", typeErr.Field, typeErr.Type.String()),
			})
		}
		middleware.RespondValidationError(w, "リクエストボディの JSON 解析に失敗しました", details)
		return
	}

	// バリデーションエラーを収集する（複数フィールドを一括検証）。
	var details []middleware.ValidationError

	if req.Title == "" {
		details = append(details, middleware.ValidationError{
			Field:   "title",
			Message: "title は必須です",
		})
	}

	var periodStart, periodEnd time.Time
	var periodStartOK, periodEndOK bool

	if ps, err := time.Parse("2006-01-02", req.PeriodStart); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "period_start",
			Message: "period_start は YYYY-MM-DD 形式でなければなりません",
		})
	} else {
		periodStart = ps
		periodStartOK = true
	}

	if pe, err := time.Parse("2006-01-02", req.PeriodEnd); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "period_end",
			Message: "period_end は YYYY-MM-DD 形式でなければなりません",
		})
	} else {
		periodEnd = pe
		periodEndOK = true
	}

	// 期間の前後関係チェック（両方のパースが成功した場合のみ）。
	if periodStartOK && periodEndOK && periodStart.After(periodEnd) {
		details = append(details, middleware.ValidationError{
			Field:   "period_end",
			Message: "period_end は period_start 以降の日付でなければなりません",
		})
	}

	// reference_report_id の UUID バリデーション。
	var refID *uuid.UUID
	if req.ReferenceReportID != nil {
		id, err := uuid.Parse(*req.ReferenceReportID)
		if err != nil {
			details = append(details, middleware.ValidationError{
				Field:   "reference_report_id",
				Message: "reference_report_id は UUID 形式でなければなりません",
			})
		} else {
			refID = &id
		}
	}

	if len(details) > 0 {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	params := service.CreateReportParams{
		Title:             req.Title,
		PeriodStart:       periodStart,
		PeriodEnd:         periodEnd,
		ReferenceReportID: refID,
	}

	detail, err := h.svc.CreateReport(r.Context(), actor, params)
	if err != nil {
		// 再申請元レポートが rejected 以外の場合、ErrInvalidPeriod が返る。
		// reference_report_id 指定時のみ VALIDATION_ERROR として details 付きで返す。
		if errors.Is(err, domain.ErrInvalidPeriod) && params.ReferenceReportID != nil {
			middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
				{Field: "reference_report_id", Message: "再申請元のレポートは rejected 状態でなければなりません"},
			})
			return
		}
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
			{Field: "report_id", Message: "report_id は UUID 形式でなければなりません"},
		})
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
			{Field: "report_id", Message: "report_id は UUID 形式でなければなりません"},
		})
		return
	}

	var req updateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var details []middleware.ValidationError
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field != "" {
			details = append(details, middleware.ValidationError{
				Field:   typeErr.Field,
				Message: fmt.Sprintf("%s の型が不正です（期待: %s）", typeErr.Field, typeErr.Type.String()),
			})
		}
		middleware.RespondValidationError(w, "リクエストボディの JSON 解析に失敗しました", details)
		return
	}

	// バリデーションエラーを収集する（複数フィールドを一括検証）。
	var details []middleware.ValidationError

	if req.Title == "" {
		details = append(details, middleware.ValidationError{
			Field:   "title",
			Message: "title は必須です",
		})
	}

	var periodStart, periodEnd time.Time
	var periodStartOK, periodEndOK bool

	if ps, err := time.Parse("2006-01-02", req.PeriodStart); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "period_start",
			Message: "period_start は YYYY-MM-DD 形式でなければなりません",
		})
	} else {
		periodStart = ps
		periodStartOK = true
	}

	if pe, err := time.Parse("2006-01-02", req.PeriodEnd); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "period_end",
			Message: "period_end は YYYY-MM-DD 形式でなければなりません",
		})
	} else {
		periodEnd = pe
		periodEndOK = true
	}

	// 期間の前後関係チェック（両方のパースが成功した場合のみ）。
	if periodStartOK && periodEndOK && periodStart.After(periodEnd) {
		details = append(details, middleware.ValidationError{
			Field:   "period_end",
			Message: "period_end は period_start 以降の日付でなければなりません",
		})
	}

	var updatedAt time.Time
	if ua, err := time.Parse(time.RFC3339, req.UpdatedAt); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at は RFC3339 形式でなければなりません",
		})
	} else {
		updatedAt = ua.UTC()
	}

	if len(details) > 0 {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	params := service.UpdateReportParams{
		Title:       req.Title,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		UpdatedAt:   updatedAt,
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
			{Field: "report_id", Message: "report_id は UUID 形式でなければなりません"},
		})
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
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
			{Field: "report_id", Message: "report_id は UUID 形式でなければなりません"},
		})
		return
	}

	var req submitReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var details []middleware.ValidationError
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field != "" {
			details = append(details, middleware.ValidationError{
				Field:   typeErr.Field,
				Message: fmt.Sprintf("%s の型が不正です（期待: %s）", typeErr.Field, typeErr.Type.String()),
			})
		}
		middleware.RespondValidationError(w, "リクエストボディの JSON 解析に失敗しました", details)
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", []middleware.ValidationError{
			{Field: "updated_at", Message: "updated_at は RFC3339 形式でなければなりません"},
		})
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
