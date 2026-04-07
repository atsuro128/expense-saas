package domain

import (
	"errors"

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
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) Submit(actorID uuid.UUID, items []ExpenseItem, hasApprover bool) error {
	return errors.New("not implemented")
}

// Approve は submitted → approved の状態遷移を行う（T2）。
//
// 事前条件:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed、自己承認禁止 RBC-016）
//
// 事後処理: status = approved、approved_at・approved_by・approval_comment をセット。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) Approve(actorID uuid.UUID, comment *string) error {
	return errors.New("not implemented")
}

// Reject は submitted → rejected の状態遷移を行う（T3）。
//
// 事前条件:
//  1. status == submitted（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfApprovalNotAllowed、自己却下禁止 RBC-016）
//  3. reason != ""（違反: ErrMissingRejectionReason、WFL-012）
//
// 事後処理: status = rejected、rejected_at・rejected_by・rejection_reason をセット。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) Reject(actorID uuid.UUID, reason string) error {
	return errors.New("not implemented")
}

// MarkAsPaid は approved → paid の状態遷移を行う（T4）。
//
// 事前条件:
//  1. status == approved（違反: ErrInvalidStateTransition）
//  2. actorID != r.UserID（違反: ErrSelfPaymentNotAllowed、自己支払禁止 RBC-012）
//
// 事後処理: status = paid、paid_at・paid_by をセット。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) MarkAsPaid(actorID uuid.UUID) error {
	return errors.New("not implemented")
}

// Delete は draft 状態のレポートを論理削除する（T5）。
//
// 事前条件:
//  1. status == draft（違反: ErrReportNotDeletable）
//
// 事後処理: deleted_at をセット。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) Delete() error {
	return errors.New("not implemented")
}

// CanEdit は report が編集可能な状態か検証する（RPT-011）。
// draft 以外は ErrReportNotEditable を返す。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (r *ExpenseReport) CanEdit() error {
	return errors.New("not implemented")
}
