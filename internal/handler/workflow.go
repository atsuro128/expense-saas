package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
	"unicode/utf8"

	"expense-saas/internal/domain"
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
// クエリパラメータ: page, per_page, applicant_name
func (h *WorkflowHandler) ListPendingReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	params, details, err := parseWorkflowListParams(r)
	if err != nil {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	reports, pagination, err := h.svc.ListPendingReports(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       reports,
		"pagination": pagination,
	})
}

// ListProcessedReports は GET /api/workflow/processed を処理します（SCR-WFL-003）。
// クエリパラメータ: page, per_page
func (h *WorkflowHandler) ListProcessedReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	params, details, err := parseProcessedListParams(r)
	if err != nil {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	reports, pagination, err := h.svc.ListProcessedReports(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       reports,
		"pagination": pagination,
	})
}

// parseProcessedListParams はクエリパラメータから処理済みレポート一覧用の WorkflowListParams を構築します。
// page のデフォルトは 1、per_page のデフォルトは 20（上限 100）。
// applicant_name フィルタは本エンドポイントでは使用しないため、WorkflowListParams の ApplicantName は nil。
func parseProcessedListParams(r *http.Request) (domain.WorkflowListParams, []middleware.ValidationError, error) {
	q := r.URL.Query()
	params := domain.WorkflowListParams{
		Page:    1,
		PerPage: 20,
	}

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	// page のパースとバリデーション。
	if pageStr := q.Get("page"); pageStr != "" {
		var page int
		if _, err := parseIntQuery(pageStr, &page); err != nil || page < 1 {
			details = append(details, middleware.ValidationError{
				Field:   "page",
				Message: "page は正の整数でなければなりません",
			})
		} else {
			params.Page = page
		}
	}

	// per_page のパースとバリデーション（上限 100）。
	if perPageStr := q.Get("per_page"); perPageStr != "" {
		var perPage int
		if _, err := parseIntQuery(perPageStr, &perPage); err != nil || perPage < 1 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page は正の整数でなければなりません",
			})
		} else if perPage > 100 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page の上限は 100 です",
			})
		} else {
			params.PerPage = perPage
		}
	}

	if len(details) > 0 {
		return params, details, fmt.Errorf("クエリパラメータにバリデーションエラーがあります")
	}

	return params, nil, nil
}

// approveReportRequest は POST /api/workflow/{id}/approve のリクエストボディを表します。
type approveReportRequest struct {
	Comment   *string `json:"comment"`
	UpdatedAt string  `json:"updated_at"`
}

// ApproveReport は POST /api/workflow/{id}/approve を処理します。
func (h *WorkflowHandler) ApproveReport(w http.ResponseWriter, r *http.Request) {
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

	var req approveReportRequest
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

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	var updatedAt time.Time
	if req.UpdatedAt == "" {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at は必須です",
		})
	} else if t, err := time.Parse(time.RFC3339, req.UpdatedAt); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at の形式が不正です",
		})
	} else {
		updatedAt = t.UTC()
	}

	if len(details) > 0 {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	detail, err := h.svc.ApproveReport(r.Context(), actor, reportID, req.Comment, updatedAt)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// rejectReportRequest は POST /api/workflow/{id}/reject のリクエストボディを表します。
type rejectReportRequest struct {
	Reason    string `json:"reason"`
	UpdatedAt string `json:"updated_at"`
}

// RejectReport は POST /api/workflow/{id}/reject を処理します。
func (h *WorkflowHandler) RejectReport(w http.ResponseWriter, r *http.Request) {
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

	var req rejectReportRequest
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

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	// reason の最大長チェック（openapi.yaml: maxLength: 1000）。
	if utf8.RuneCountInString(req.Reason) > 1000 {
		details = append(details, middleware.ValidationError{
			Field:   "reason",
			Message: "reason は 1000 文字以下でなければなりません",
		})
	}

	var updatedAt time.Time
	if req.UpdatedAt == "" {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at は必須です",
		})
	} else if t, err := time.Parse(time.RFC3339, req.UpdatedAt); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at の形式が不正です",
		})
	} else {
		updatedAt = t.UTC()
	}

	if len(details) > 0 {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	detail, err := h.svc.RejectReport(r.Context(), actor, reportID, req.Reason, updatedAt)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// ListPayableReports は GET /api/workflow/payable を処理します。
// クエリパラメータ: page, per_page, applicant_name
func (h *WorkflowHandler) ListPayableReports(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	params, details, err := parseWorkflowListParams(r)
	if err != nil {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	reports, pagination, err := h.svc.ListPayableReports(r.Context(), actor, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       reports,
		"pagination": pagination,
	})
}

// markAsPaidRequest は POST /api/workflow/{id}/pay のリクエストボディを表します。
type markAsPaidRequest struct {
	UpdatedAt string `json:"updated_at"`
}

// MarkReportAsPaid は POST /api/workflow/{id}/pay を処理します。
func (h *WorkflowHandler) MarkReportAsPaid(w http.ResponseWriter, r *http.Request) {
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

	var req markAsPaidRequest
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

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	var updatedAt time.Time
	if req.UpdatedAt == "" {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at は必須です",
		})
	} else if t, err := time.Parse(time.RFC3339, req.UpdatedAt); err != nil {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at の形式が不正です",
		})
	} else {
		updatedAt = t.UTC()
	}

	if len(details) > 0 {
		middleware.RespondValidationError(w, "入力パラメータに誤りがあります", details)
		return
	}

	detail, err := h.svc.MarkReportAsPaid(r.Context(), actor, reportID, updatedAt)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// parseWorkflowListParams はクエリパラメータから WorkflowListParams を構築します。
// page のデフォルトは 1、per_page のデフォルトは 20（上限 100）。
// バリデーションエラーがある場合は details にフィールド単位のエラーを蓄積して返します。
func parseWorkflowListParams(r *http.Request) (domain.WorkflowListParams, []middleware.ValidationError, error) {
	q := r.URL.Query()
	params := domain.WorkflowListParams{
		Page:    1,
		PerPage: 20,
	}

	// バリデーションエラーを収集する。
	var details []middleware.ValidationError

	// page のパースとバリデーション。
	if pageStr := q.Get("page"); pageStr != "" {
		var page int
		if _, err := parseIntQuery(pageStr, &page); err != nil || page < 1 {
			details = append(details, middleware.ValidationError{
				Field:   "page",
				Message: "page は正の整数でなければなりません",
			})
		} else {
			params.Page = page
		}
	}

	// per_page のパースとバリデーション（上限 100）。
	if perPageStr := q.Get("per_page"); perPageStr != "" {
		var perPage int
		if _, err := parseIntQuery(perPageStr, &perPage); err != nil || perPage < 1 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page は正の整数でなければなりません",
			})
		} else if perPage > 100 {
			details = append(details, middleware.ValidationError{
				Field:   "per_page",
				Message: "per_page の上限は 100 です",
			})
		} else {
			params.PerPage = perPage
		}
	}

	// applicant_name は省略可能な部分一致フィルタ。
	if name := q.Get("applicant_name"); name != "" {
		params.ApplicantName = &name
	}

	if len(details) > 0 {
		return params, details, fmt.Errorf("クエリパラメータにバリデーションエラーがあります")
	}

	return params, nil, nil
}
