package handler

import (
	"encoding/json"
	"net/http"
	"time"
	"unicode/utf8"

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
// 一覧取得（クエリパラメータ・ページネーション含む）は 10-F で実装する。
func (h *WorkflowHandler) ListPendingReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
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
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req approveReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.UpdatedAt == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "updated_at is required")
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid updated_at format")
		return
	}

	detail, err := h.svc.ApproveReport(r.Context(), actor, reportID, req.Comment, updatedAt.UTC())
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
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req rejectReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	// reason の最大長チェック（openapi.yaml: maxLength: 1000）。
	if utf8.RuneCountInString(req.Reason) > 1000 {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "reason must be 1000 characters or less")
		return
	}

	if req.UpdatedAt == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "updated_at is required")
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid updated_at format")
		return
	}

	detail, err := h.svc.RejectReport(r.Context(), actor, reportID, req.Reason, updatedAt.UTC())
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}

// ListPayableReports は GET /api/workflow/payable を処理します。
// 一覧取得（クエリパラメータ・ページネーション含む）は 10-F で実装する。
func (h *WorkflowHandler) ListPayableReports(w http.ResponseWriter, r *http.Request) {
	middleware.RespondError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Not implemented")
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
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req markAsPaidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.UpdatedAt == "" {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "updated_at is required")
		return
	}

	updatedAt, err := time.Parse(time.RFC3339, req.UpdatedAt)
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid updated_at format")
		return
	}

	detail, err := h.svc.MarkReportAsPaid(r.Context(), actor, reportID, updatedAt.UTC())
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{"data": detail})
}
