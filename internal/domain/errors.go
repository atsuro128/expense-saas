package domain

import "errors"

// Domain sentinel errors. Handlers map these to HTTP status codes.
var (
	// ErrInvalidStateTransition is returned when an invalid state transition is attempted (WFL-001, WFL-002).
	// HTTP: 422 INVALID_STATE_TRANSITION
	ErrInvalidStateTransition = errors.New("invalid state transition")

	// ErrSelfApprovalNotAllowed is returned when a user attempts to approve/reject their own report (RBC-016).
	// HTTP: 403 SELF_APPROVAL_NOT_ALLOWED
	ErrSelfApprovalNotAllowed = errors.New("self approval not allowed")

	// ErrSelfPaymentNotAllowed is returned when a user attempts to record payment on their own report (RBC-012).
	// HTTP: 403 SELF_PAYMENT_NOT_ALLOWED
	ErrSelfPaymentNotAllowed = errors.New("self payment not allowed")

	// ErrEmptyReportSubmission is returned when submitting a report with zero expense items (RPT-014).
	// HTTP: 422 EMPTY_REPORT
	ErrEmptyReportSubmission = errors.New("report has no expense items")

	// ErrInvalidPeriod is returned when period_start > period_end (RPT-003).
	// HTTP: 422 INVALID_PERIOD
	ErrInvalidPeriod = errors.New("period_start must be before or equal to period_end")

	// ErrInvalidAmount is returned when amount <= 0 (ITM-002).
	// HTTP: 422 INVALID_AMOUNT
	ErrInvalidAmount = errors.New("amount must be a positive integer")

	// ErrReportNotEditable is returned when editing a report that is not in draft status (RPT-011).
	// HTTP: 422 REPORT_NOT_EDITABLE
	ErrReportNotEditable = errors.New("report is not editable in current status")

	// ErrNoApproverInTenant is returned when submitting a report but the tenant has no Approver (WFL-014).
	// HTTP: 422 NO_APPROVER
	ErrNoApproverInTenant = errors.New("tenant has no approver")

	// ErrReportNotDeletable is returned when deleting a report that is not in draft status (RPT-013).
	// HTTP: 422 REPORT_NOT_DELETABLE
	ErrReportNotDeletable = errors.New("report can only be deleted in draft status")

	// ErrResourceNotFound is returned when a resource is not found or crosses tenant boundaries.
	// HTTP: 404 RESOURCE_NOT_FOUND
	ErrResourceNotFound = errors.New("resource not found")

	// ErrForbidden is returned when role or ownership check fails.
	// HTTP: 403 FORBIDDEN
	ErrForbidden = errors.New("forbidden")

	// ErrInvalidFileType is returned when an uploaded file has a disallowed MIME type (ATT-013).
	// HTTP: 422 INVALID_FILE_TYPE
	ErrInvalidFileType = errors.New("invalid file type")

	// ErrFileTooLarge is returned when an uploaded file exceeds the 5 MB limit (ATT-003).
	// HTTP: 413 FILE_TOO_LARGE
	ErrFileTooLarge = errors.New("file size exceeds the 5MB limit")

	// ErrMissingRejectionReason is returned when a rejection is attempted without a reason (WFL-012).
	// HTTP: 422 MISSING_REJECTION_REASON
	ErrMissingRejectionReason = errors.New("rejection reason is required")

	// ErrConflict is returned on optimistic lock failure (concurrent update detected).
	// HTTP: 409 CONFLICT
	ErrConflict = errors.New("conflict: resource was modified by another request")

	// ErrEmailAlreadyExists is returned when signing up with a duplicate email address.
	// HTTP: 409 EMAIL_ALREADY_EXISTS
	ErrEmailAlreadyExists = errors.New("email address is already registered")

	// ErrInvalidCredentials is returned when login credentials are incorrect (SEC-011).
	// HTTP: 401 INVALID_CREDENTIALS
	ErrInvalidCredentials = errors.New("invalid credentials")

	// ErrTokenExpired is returned when a JWT or reset token has expired.
	// HTTP: 401 UNAUTHORIZED
	ErrTokenExpired = errors.New("token has expired")

	// ErrTokenRevoked is returned when a revoked refresh token is used.
	// HTTP: 401 UNAUTHORIZED
	ErrTokenRevoked = errors.New("token has been revoked")
)
