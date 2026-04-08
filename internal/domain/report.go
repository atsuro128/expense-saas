package domain

import (
	"time"

	"github.com/google/uuid"
)

// Submit は draft → submitted の状態遷移を行う（T1）。
//
// 事前条件（WFL-002, RPT-014, WFL-014）:
//  1. status == draft（違反: ErrInvalidStateTransition）
//  2. len(items) >= 1（違反: ErrEmptyReportSubmission）
//  3. hasApprover == true（違反: ErrNoApproverInTenant）
//
// 事後処理: status = submitted、submitted_at と submitted_by をセット、total_amount を再計算。
func (r *ExpenseReport) Submit(actorID uuid.UUID, items []ExpenseItem, hasApprover bool) error {
	// (1) 状態チェック: draft 以外は InvalidStateTransition。
	if r.Status != ReportStatusDraft {
		return ErrInvalidStateTransition
	}

	// (2) 明細件数チェック: 0 件は EmptyReportSubmission。
	if len(items) == 0 {
		return ErrEmptyReportSubmission
	}

	// (3) 承認者存在チェック: テナントに Approver がいない場合は NoApproverInTenant。
	if !hasApprover {
		return ErrNoApproverInTenant
	}

	// 事後処理: 状態更新、提出情報の記録、合計金額の再計算（RPT-006）。
	now := time.Now().UTC()
	r.Status = ReportStatusSubmitted
	r.SubmittedAt = &now
	r.SubmittedBy = &actorID

	// 明細の合計金額を再計算する（RPT-006）。
	total := 0
	for _, item := range items {
		total += item.Amount
	}
	r.TotalAmount = total

	return nil
}

// Approve は submitted → approved の状態遷移を行う（T2）。
//
// 事前条件（WFL-002, RBC-016）:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed）
//
// 事後処理: status = approved、approved_at・approved_by・approval_comment をセット。
func (r *ExpenseReport) Approve(actorID uuid.UUID, comment *string) error {
	// (1) 状態チェック: submitted 以外は InvalidStateTransition。
	if r.Status != ReportStatusSubmitted {
		return ErrInvalidStateTransition
	}

	// (2) 自己承認禁止（RBC-016）。
	if r.UserID == actorID {
		return ErrSelfApprovalNotAllowed
	}

	// 事後処理: 状態更新、承認情報の記録。
	now := time.Now().UTC()
	r.Status = ReportStatusApproved
	r.ApprovedAt = &now
	r.ApprovedBy = &actorID
	r.ApprovalComment = comment

	return nil
}

// Reject は submitted → rejected の状態遷移を行う（T3）。
//
// 事前条件（WFL-002, RBC-016, WFL-012）:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed）
//  3. reason != ""（違反: ErrMissingRejectionReason）
//
// 事後処理: status = rejected、rejected_at・rejected_by・rejection_reason をセット。
func (r *ExpenseReport) Reject(actorID uuid.UUID, reason string) error {
	// (1) 状態チェック: submitted 以外は InvalidStateTransition。
	if r.Status != ReportStatusSubmitted {
		return ErrInvalidStateTransition
	}

	// (2) 自己却下禁止（RBC-016）。
	if r.UserID == actorID {
		return ErrSelfApprovalNotAllowed
	}

	// (3) 却下理由必須（WFL-012）。
	if reason == "" {
		return ErrMissingRejectionReason
	}

	// 事後処理: 状態更新、却下情報の記録。
	now := time.Now().UTC()
	r.Status = ReportStatusRejected
	r.RejectedAt = &now
	r.RejectedBy = &actorID
	r.RejectionReason = &reason

	return nil
}

// MarkAsPaid は approved → paid の状態遷移を行う（T4）。
//
// 事前条件（WFL-002, RBC-012）:
//  1. status == approved（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfPaymentNotAllowed）
//
// 事後処理: status = paid、paid_at・paid_by をセット。
func (r *ExpenseReport) MarkAsPaid(actorID uuid.UUID) error {
	// (1) 状態チェック: approved 以外は InvalidStateTransition。
	if r.Status != ReportStatusApproved {
		return ErrInvalidStateTransition
	}

	// (2) 自己支払禁止（RBC-012）。
	if r.UserID == actorID {
		return ErrSelfPaymentNotAllowed
	}

	// 事後処理: 状態更新、支払情報の記録。
	now := time.Now().UTC()
	r.Status = ReportStatusPaid
	r.PaidAt = &now
	r.PaidBy = &actorID

	return nil
}

// Delete は draft 状態のレポートを論理削除する（T5）。
//
// 事前条件（RPT-013）:
//  1. status == draft（違反: ErrReportNotDeletable）
//
// 事後処理: deleted_at をセット（論理削除 DAT-002）。
func (r *ExpenseReport) Delete() error {
	// (1) 状態チェック: draft 以外は ReportNotDeletable。
	if r.Status != ReportStatusDraft {
		return ErrReportNotDeletable
	}

	// 事後処理: 論理削除。
	now := time.Now().UTC()
	r.DeletedAt = &now

	return nil
}

// CanEdit は report が編集可能な状態か検証する（RPT-011）。
// draft 状態でのみ編集可能。それ以外の状態では ErrReportNotEditable を返す。
func (r *ExpenseReport) CanEdit() error {
	if r.Status != ReportStatusDraft {
		return ErrReportNotEditable
	}
	return nil
}
