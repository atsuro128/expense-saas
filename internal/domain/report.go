package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// Submit は draft → submitted の状態遷移を行う（T1）。
//
// 事前条件:
//  1. status == draft（違反: ErrInvalidStateTransition）
//  2. len(items) >= 1（違反: ErrEmptyReportSubmission）
//  3. hasApprover == true（違反: ErrNoApproverInTenant）
//
// 事後処理: status = submitted、submitted_at と submitted_by をセット、total_amount を再計算。
func (r *ExpenseReport) Submit(actorID uuid.UUID, items []ExpenseItem, hasApprover bool) error {
	if r.Status != ReportStatusDraft {
		return ErrInvalidStateTransition
	}
	if len(items) == 0 {
		return ErrEmptyReportSubmission
	}
	if !hasApprover {
		return ErrNoApproverInTenant
	}

	// 合計金額を再計算する。
	total := 0
	for _, item := range items {
		total += item.Amount
	}

	now := time.Now().UTC()
	r.Status = ReportStatusSubmitted
	r.SubmittedAt = &now
	r.SubmittedBy = &actorID
	r.TotalAmount = total
	return nil
}

// Approve は submitted → approved の状態遷移を行う（T2）。
//
// 事前条件:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed、自己承認禁止 RBC-016）
//
// 事後処理: status = approved、approved_at・approved_by・approval_comment をセット。
func (r *ExpenseReport) Approve(actorID uuid.UUID, comment *string) error {
	if r.Status != ReportStatusSubmitted {
		return ErrInvalidStateTransition
	}
	if actorID == r.UserID {
		return ErrSelfApprovalNotAllowed
	}

	now := time.Now().UTC()
	r.Status = ReportStatusApproved
	r.ApprovedAt = &now
	r.ApprovedBy = &actorID
	r.ApprovalComment = comment
	return nil
}

// Reject は submitted → rejected の状態遷移を行う（T3）。
//
// 事前条件:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed、自己却下禁止 RBC-016）
//  3. reason != ""（違反: ErrMissingRejectionReason、WFL-012）
//
// 事後処理: status = rejected、rejected_at・rejected_by・rejection_reason をセット。
func (r *ExpenseReport) Reject(actorID uuid.UUID, reason string) error {
	if r.Status != ReportStatusSubmitted {
		return ErrInvalidStateTransition
	}
	if actorID == r.UserID {
		return ErrSelfApprovalNotAllowed
	}
	if strings.TrimSpace(reason) == "" {
		return ErrMissingRejectionReason
	}

	now := time.Now().UTC()
	r.Status = ReportStatusRejected
	r.RejectedAt = &now
	r.RejectedBy = &actorID
	r.RejectionReason = &reason
	return nil
}

// MarkAsPaid は approved → paid の状態遷移を行う（T4）。
//
// 事前条件:
//  1. status == approved（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfPaymentNotAllowed、自己支払禁止 RBC-012）
//
// 事後処理: status = paid、paid_at・paid_by をセット。
func (r *ExpenseReport) MarkAsPaid(actorID uuid.UUID) error {
	if r.Status != ReportStatusApproved {
		return ErrInvalidStateTransition
	}
	if actorID == r.UserID {
		return ErrSelfPaymentNotAllowed
	}

	now := time.Now().UTC()
	r.Status = ReportStatusPaid
	r.PaidAt = &now
	r.PaidBy = &actorID
	return nil
}

// Delete は draft 状態のレポートを論理削除する（T5）。
//
// 事前条件:
//  1. status == draft（違反: ErrReportNotDeletable）
//
// 事後処理: deleted_at をセット。
func (r *ExpenseReport) Delete() error {
	if r.Status != ReportStatusDraft {
		return ErrReportNotDeletable
	}

	now := time.Now().UTC()
	r.DeletedAt = &now
	return nil
}

// CanEdit は report が編集可能な状態か検証する（RPT-011）。
// draft 以外は ErrReportNotEditable を返す。
func (r *ExpenseReport) CanEdit() error {
	if r.Status != ReportStatusDraft {
		return ErrReportNotEditable
	}
	return nil
}
