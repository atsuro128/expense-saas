package domain

import "errors"

// ドメイン層のセンチネルエラー。ハンドラ層でこれらを HTTP ステータスコードにマッピングする。
var (
	// ErrInvalidStateTransition は不正な状態遷移が試みられた場合に返す（WFL-001, WFL-002）。
	// HTTP: 422 INVALID_STATE_TRANSITION
	ErrInvalidStateTransition = errors.New("invalid state transition")

	// ErrSelfApprovalNotAllowed はユーザーが自分のレポートを承認・却下しようとした場合に返す（RBC-016）。
	// HTTP: 403 SELF_APPROVAL_NOT_ALLOWED
	ErrSelfApprovalNotAllowed = errors.New("self approval not allowed")

	// ErrSelfPaymentNotAllowed はユーザーが自分のレポートの支払い処理をしようとした場合に返す（RBC-012）。
	// HTTP: 403 SELF_PAYMENT_NOT_ALLOWED
	ErrSelfPaymentNotAllowed = errors.New("self payment not allowed")

	// ErrEmptyReportSubmission は経費明細が0件のレポートを申請しようとした場合に返す（RPT-014）。
	// HTTP: 422 EMPTY_REPORT
	ErrEmptyReportSubmission = errors.New("report has no expense items")

	// ErrInvalidPeriod は period_start > period_end の場合に返す（RPT-003）。
	// HTTP: 422 INVALID_PERIOD
	ErrInvalidPeriod = errors.New("period_start must be before or equal to period_end")

	// ErrInvalidAmount は金額が0以下の場合に返す（ITM-002）。
	// HTTP: 422 INVALID_AMOUNT
	ErrInvalidAmount = errors.New("amount must be a positive integer")

	// ErrReportNotEditable はドラフト以外のステータスのレポートを編集しようとした場合に返す（RPT-011）。
	// HTTP: 422 REPORT_NOT_EDITABLE
	ErrReportNotEditable = errors.New("report is not editable in current status")

	// ErrNoApproverInTenant はテナントに承認者が存在しない状態でレポートを申請しようとした場合に返す（WFL-014）。
	// HTTP: 422 NO_APPROVER
	ErrNoApproverInTenant = errors.New("tenant has no approver")

	// ErrReportNotDeletable はドラフト以外のステータスのレポートを削除しようとした場合に返す（RPT-013）。
	// HTTP: 422 REPORT_NOT_DELETABLE
	ErrReportNotDeletable = errors.New("report can only be deleted in draft status")

	// ErrResourceNotFound はリソースが存在しない、またはテナント境界を越えたアクセスが発生した場合に返す。
	// HTTP: 404 RESOURCE_NOT_FOUND
	ErrResourceNotFound = errors.New("resource not found")

	// ErrForbidden はロールまたは所有権チェックが失敗した場合に返す。
	// HTTP: 403 FORBIDDEN
	ErrForbidden = errors.New("forbidden")

	// ErrInvalidFileType はアップロードされたファイルの MIME タイプが許可されていない場合に返す（ATT-013）。
	// HTTP: 422 INVALID_FILE_TYPE
	ErrInvalidFileType = errors.New("invalid file type")

	// ErrFileTooLarge はアップロードされたファイルが 5MB 制限を超えた場合に返す（ATT-003）。
	// HTTP: 413 FILE_TOO_LARGE
	ErrFileTooLarge = errors.New("file size exceeds the 5MB limit")

	// ErrMissingRejectionReason は却下理由なしで却下操作が試みられた場合に返す（WFL-012）。
	// HTTP: 422 MISSING_REJECTION_REASON
	ErrMissingRejectionReason = errors.New("rejection reason is required")

	// ErrConflict は楽観的ロックの失敗（同時更新の検出）時に返す。
	// HTTP: 409 CONFLICT
	ErrConflict = errors.New("conflict: resource was modified by another request")

	// ErrEmailAlreadyExists は重複するメールアドレスでサインアップしようとした場合に返す。
	// HTTP: 409 EMAIL_ALREADY_EXISTS
	ErrEmailAlreadyExists = errors.New("email address is already registered")

	// ErrInvalidCredentials はログイン認証情報が誤っている場合に返す（SEC-011）。
	// HTTP: 401 INVALID_CREDENTIALS
	ErrInvalidCredentials = errors.New("invalid credentials")

	// ErrTokenExpired は JWT またはリセットトークンが期限切れの場合に返す。
	// HTTP: 401 UNAUTHORIZED
	ErrTokenExpired = errors.New("token has expired")

	// ErrTokenRevoked は失効済みのリフレッシュトークンが使用された場合に返す。
	// HTTP: 401 UNAUTHORIZED
	ErrTokenRevoked = errors.New("token has been revoked")
)
