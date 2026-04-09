package handler

import (
	"net/http"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
)

// actorFromRequest は Auth および TenantContext middleware がセットしたコンテキスト値から
// domain.Actor を生成して返します。
// 必須値が存在しないか不正な形式の場合は false を返します。
func actorFromRequest(r *http.Request) (domain.Actor, bool) {
	userIDStr := middleware.GetUserID(r.Context())
	tenantIDStr := middleware.GetTenantID(r.Context())
	roleStr := middleware.GetRole(r.Context())

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return domain.Actor{}, false
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return domain.Actor{}, false
	}

	role := domain.Role(roleStr)
	if !role.IsValid() {
		return domain.Actor{}, false
	}

	return domain.Actor{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
	}, true
}

// respondDomainError はドメインエラーを適切な HTTP ステータスコードとエラーコードにマッピングして
// レスポンスを返します。
// 既知のドメインエラー以外は 500 Internal Server Error を返します。
func respondDomainError(w http.ResponseWriter, err error) {
	switch err {
	case domain.ErrResourceNotFound:
		middleware.RespondError(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", err.Error())
	case domain.ErrForbidden:
		middleware.RespondError(w, http.StatusForbidden, "FORBIDDEN", err.Error())
	case domain.ErrSelfApprovalNotAllowed:
		middleware.RespondError(w, http.StatusForbidden, "SELF_APPROVAL_NOT_ALLOWED", err.Error())
	case domain.ErrSelfPaymentNotAllowed:
		middleware.RespondError(w, http.StatusForbidden, "SELF_PAYMENT_NOT_ALLOWED", err.Error())
	case domain.ErrInvalidStateTransition:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_STATE_TRANSITION", err.Error())
	case domain.ErrEmptyReportSubmission:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "EMPTY_REPORT_SUBMISSION", err.Error())
	case domain.ErrNoApproverInTenant:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "NO_APPROVER_IN_TENANT", err.Error())
	case domain.ErrReportNotEditable:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "REPORT_NOT_EDITABLE", err.Error())
	case domain.ErrReportNotDeletable:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "REPORT_NOT_DELETABLE", err.Error())
	case domain.ErrMissingRejectionReason:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "MISSING_REJECTION_REASON", err.Error())
	case domain.ErrConflict:
		middleware.RespondError(w, http.StatusConflict, "CONFLICT", err.Error())
	case domain.ErrInvalidPeriod:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", err.Error())
	case domain.ErrInvalidAmount:
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", err.Error())
	default:
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
	}
}
