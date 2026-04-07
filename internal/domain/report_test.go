package domain_test

// ドメイン層単体テスト（状態遷移）。
// DB を使わず、ドメインオブジェクトを直接構築してメソッドを呼ぶ。
//
// 対応テストケース: RPT-048〜RPT-052, RPT-065〜RPT-090
// (state_machine.md T1〜T5 / X1〜X10 許可・禁止遷移)

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// ============================================================
// ヘルパー
// ============================================================

// newReport はテスト用の ExpenseReport を指定ステータスで構築する。
func newReport(status domain.ReportStatus, ownerID uuid.UUID) *domain.ExpenseReport {
	return &domain.ExpenseReport{
		ReportID:  uuid.New(),
		TenantID:  uuid.New(),
		UserID:    ownerID,
		Title:     "テストレポート",
		Status:    status,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
}

// oneItem は明細 1 件のスライスを返す（提出の事前条件を満たすため）。
func oneItem() []domain.ExpenseItem {
	return []domain.ExpenseItem{
		{ItemID: uuid.New(), Amount: 1000},
	}
}

// twoItems は明細 2 件（1000円 + 2000円）のスライスを返す。
func twoItems() []domain.ExpenseItem {
	return []domain.ExpenseItem{
		{ItemID: uuid.New(), Amount: 1000},
		{ItemID: uuid.New(), Amount: 2000},
	}
}

// ============================================================
// T5: draft → 削除（RPT-048〜RPT-052）
// ============================================================

// RPT-048: draft 状態での Delete() は成功し deleted_at がセットされる。
func TestReport_Delete_DraftSuccess(t *testing.T) {
	r := newReport(domain.ReportStatusDraft, uuid.New())
	if err := r.Delete(); err != nil {
		t.Fatalf("Delete() error = %v, want nil", err)
	}
	if r.DeletedAt == nil {
		t.Error("DeletedAt は nil 以外を期待するが nil だった")
	}
}

// RPT-049: submitted 状態での Delete() は ErrReportNotDeletable を返す。
func TestReport_Delete_SubmittedFails(t *testing.T) {
	r := newReport(domain.ReportStatusSubmitted, uuid.New())
	err := r.Delete()
	if err != domain.ErrReportNotDeletable {
		t.Fatalf("Delete() error = %v, want ErrReportNotDeletable", err)
	}
}

// RPT-050: approved 状態での Delete() は ErrReportNotDeletable を返す。
func TestReport_Delete_ApprovedFails(t *testing.T) {
	r := newReport(domain.ReportStatusApproved, uuid.New())
	err := r.Delete()
	if err != domain.ErrReportNotDeletable {
		t.Fatalf("Delete() error = %v, want ErrReportNotDeletable", err)
	}
}

// RPT-051: rejected 状態での Delete() は ErrReportNotDeletable を返す。
func TestReport_Delete_RejectedFails(t *testing.T) {
	r := newReport(domain.ReportStatusRejected, uuid.New())
	err := r.Delete()
	if err != domain.ErrReportNotDeletable {
		t.Fatalf("Delete() error = %v, want ErrReportNotDeletable", err)
	}
}

// RPT-052: paid 状態での Delete() は ErrReportNotDeletable を返す。
func TestReport_Delete_PaidFails(t *testing.T) {
	r := newReport(domain.ReportStatusPaid, uuid.New())
	err := r.Delete()
	if err != domain.ErrReportNotDeletable {
		t.Fatalf("Delete() error = %v, want ErrReportNotDeletable", err)
	}
}

// ============================================================
// T1: draft → submitted（RPT-065〜RPT-072）
// ============================================================

// RPT-065: draft + 明細1件 + Approver あり → 提出成功。
// status=submitted, submitted_at/submitted_by がセットされる。
func TestReport_Submit_DraftSuccess(t *testing.T) {
	ownerID := uuid.MustParse("aaaaaaaa-3333-3333-3333-000000000003")
	r := newReport(domain.ReportStatusDraft, ownerID)
	items := oneItem()

	err := r.Submit(ownerID, items, true)
	if err != nil {
		t.Fatalf("Submit() error = %v, want nil", err)
	}
	if r.Status != domain.ReportStatusSubmitted {
		t.Errorf("Status = %v, want submitted", r.Status)
	}
	if r.SubmittedAt == nil {
		t.Error("SubmittedAt は nil 以外を期待するが nil だった")
	}
	if r.SubmittedBy == nil || *r.SubmittedBy != ownerID {
		t.Errorf("SubmittedBy = %v, want %v", r.SubmittedBy, ownerID)
	}
}

// RPT-066: draft + 明細 0 件 → EmptyReportSubmission エラー。
func TestReport_Submit_EmptyItemsFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusDraft, ownerID)
	err := r.Submit(ownerID, nil, true)
	if err != domain.ErrEmptyReportSubmission {
		t.Fatalf("Submit() error = %v, want ErrEmptyReportSubmission", err)
	}
}

// RPT-067: submitted 状態での Submit() → InvalidStateTransition エラー。
func TestReport_Submit_AlreadySubmittedFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-068: approved 状態での Submit() → InvalidStateTransition エラー。
func TestReport_Submit_ApprovedFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-069: rejected 状態での Submit() → InvalidStateTransition エラー。
func TestReport_Submit_RejectedFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusRejected, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-070: paid 状態での Submit() → InvalidStateTransition エラー。
func TestReport_Submit_PaidFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusPaid, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-071: draft + 明細あり + Approver なし → NoApproverInTenant エラー。
func TestReport_Submit_NoApproverInTenantFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusDraft, ownerID)
	err := r.Submit(ownerID, oneItem(), false)
	if err != domain.ErrNoApproverInTenant {
		t.Fatalf("Submit() error = %v, want ErrNoApproverInTenant", err)
	}
}

// RPT-072: 明細 2 件（1000+2000）で提出 → total_amount = 3000。
func TestReport_Submit_TotalAmountRecalculated(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusDraft, ownerID)
	items := twoItems()

	if err := r.Submit(ownerID, items, true); err != nil {
		t.Fatalf("Submit() error = %v, want nil", err)
	}
	if r.TotalAmount != 3000 {
		t.Errorf("TotalAmount = %v, want 3000", r.TotalAmount)
	}
}

// ============================================================
// 禁止遷移 X1〜X10（RPT-073〜RPT-082）
// ============================================================

// RPT-073: X1 — draft → approved は禁止（Approve() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X1_DraftToApproved(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New() // 別ユーザー
	r := newReport(domain.ReportStatusDraft, ownerID)
	err := r.Approve(actorID, nil)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Approve() on draft: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-074: X2 — draft → rejected は禁止（Reject() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X2_DraftToRejected(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusDraft, ownerID)
	err := r.Reject(actorID, "理由")
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Reject() on draft: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-075: X3 — draft → paid は禁止（MarkAsPaid() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X3_DraftToPaid(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusDraft, ownerID)
	err := r.MarkAsPaid(actorID)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("MarkAsPaid() on draft: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-076: X4 — submitted → draft は禁止（Submit() を再度呼ぶと InvalidStateTransition）。
func TestReport_Transition_X4_SubmittedToDraft(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	// submitted 状態で Submit() を呼ぼうとすると InvalidStateTransition
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() on submitted: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-077: X5 — submitted → paid は禁止（MarkAsPaid() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X5_SubmittedToPaid(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	err := r.MarkAsPaid(actorID)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("MarkAsPaid() on submitted: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-078: X6 — approved → draft は禁止（Submit() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X6_ApprovedToDraft(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() on approved: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-079: X7 — approved → submitted は禁止（Submit() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X7_ApprovedToSubmitted(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)
	err := r.Submit(ownerID, oneItem(), true)
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Submit() on approved: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-080: X8 — approved → rejected は禁止（Reject() を呼ぶと InvalidStateTransition）。
func TestReport_Transition_X8_ApprovedToRejected(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)
	err := r.Reject(actorID, "理由")
	if err != domain.ErrInvalidStateTransition {
		t.Fatalf("Reject() on approved: error = %v, want ErrInvalidStateTransition", err)
	}
}

// RPT-081: X9 — rejected は終端状態。Submit/Approve/Reject/MarkAsPaid いずれも InvalidStateTransition。
func TestReport_Transition_X9_RejectedToAny(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()

	cases := []struct {
		name string
		fn   func(*domain.ExpenseReport) error
	}{
		{"Submit", func(r *domain.ExpenseReport) error { return r.Submit(ownerID, oneItem(), true) }},
		{"Approve", func(r *domain.ExpenseReport) error { return r.Approve(actorID, nil) }},
		{"Reject", func(r *domain.ExpenseReport) error { return r.Reject(actorID, "理由") }},
		{"MarkAsPaid", func(r *domain.ExpenseReport) error { return r.MarkAsPaid(actorID) }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := newReport(domain.ReportStatusRejected, ownerID)
			err := tc.fn(r)
			if err != domain.ErrInvalidStateTransition {
				t.Fatalf("%s() on rejected: error = %v, want ErrInvalidStateTransition", tc.name, err)
			}
		})
	}
}

// RPT-082: X10 — paid は終端状態。Submit/Approve/Reject/MarkAsPaid いずれも InvalidStateTransition。
func TestReport_Transition_X10_PaidToAny(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()

	cases := []struct {
		name string
		fn   func(*domain.ExpenseReport) error
	}{
		{"Submit", func(r *domain.ExpenseReport) error { return r.Submit(ownerID, oneItem(), true) }},
		{"Approve", func(r *domain.ExpenseReport) error { return r.Approve(actorID, nil) }},
		{"Reject", func(r *domain.ExpenseReport) error { return r.Reject(actorID, "理由") }},
		{"MarkAsPaid", func(r *domain.ExpenseReport) error { return r.MarkAsPaid(actorID) }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := newReport(domain.ReportStatusPaid, ownerID)
			err := tc.fn(r)
			if err != domain.ErrInvalidStateTransition {
				t.Fatalf("%s() on paid: error = %v, want ErrInvalidStateTransition", tc.name, err)
			}
		})
	}
}

// ============================================================
// 許可遷移 T2〜T4（RPT-083〜RPT-090）
// ============================================================

// RPT-083: T2 — submitted + 他ユーザー → Approve() 成功。
// status=approved, approved_at/approved_by がセットされる。
func TestReport_Approve_SubmittedSuccess(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New() // 別ユーザー
	r := newReport(domain.ReportStatusSubmitted, ownerID)

	if err := r.Approve(actorID, nil); err != nil {
		t.Fatalf("Approve() error = %v, want nil", err)
	}
	if r.Status != domain.ReportStatusApproved {
		t.Errorf("Status = %v, want approved", r.Status)
	}
	if r.ApprovedAt == nil {
		t.Error("ApprovedAt は nil 以外を期待するが nil だった")
	}
	if r.ApprovedBy == nil || *r.ApprovedBy != actorID {
		t.Errorf("ApprovedBy = %v, want %v", r.ApprovedBy, actorID)
	}
}

// RPT-084: T2 — submitted + 自己承認 → SelfApprovalNotAllowed エラー（RBC-016）。
func TestReport_Approve_SelfApprovalFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	err := r.Approve(ownerID, nil) // 所有者が自己承認
	if err != domain.ErrSelfApprovalNotAllowed {
		t.Fatalf("Approve() self: error = %v, want ErrSelfApprovalNotAllowed", err)
	}
}

// RPT-085: T2 — approval_comment がセットされること。
func TestReport_Approve_WithComment(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	comment := "承認コメント"

	if err := r.Approve(actorID, &comment); err != nil {
		t.Fatalf("Approve() error = %v, want nil", err)
	}
	if r.ApprovalComment == nil || *r.ApprovalComment != comment {
		t.Errorf("ApprovalComment = %v, want %q", r.ApprovalComment, comment)
	}
}

// RPT-086: T3 — submitted + 他ユーザー + 理由あり → Reject() 成功。
// status=rejected, rejected_at/rejected_by/rejection_reason がセットされる。
func TestReport_Reject_SubmittedSuccess(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	reason := "理由"

	if err := r.Reject(actorID, reason); err != nil {
		t.Fatalf("Reject() error = %v, want nil", err)
	}
	if r.Status != domain.ReportStatusRejected {
		t.Errorf("Status = %v, want rejected", r.Status)
	}
	if r.RejectedAt == nil {
		t.Error("RejectedAt は nil 以外を期待するが nil だった")
	}
	if r.RejectedBy == nil || *r.RejectedBy != actorID {
		t.Errorf("RejectedBy = %v, want %v", r.RejectedBy, actorID)
	}
	if r.RejectionReason == nil || *r.RejectionReason != reason {
		t.Errorf("RejectionReason = %v, want %q", r.RejectionReason, reason)
	}
}

// RPT-087: T3 — rejection_reason="" → MissingRejectionReason エラー（WFL-012）。
func TestReport_Reject_EmptyReasonFails(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	err := r.Reject(actorID, "")
	if err != domain.ErrMissingRejectionReason {
		t.Fatalf("Reject() empty reason: error = %v, want ErrMissingRejectionReason", err)
	}
}

// RPT-088: T3 — 自己却下 → SelfApprovalNotAllowed エラー（RBC-016）。
func TestReport_Reject_SelfRejectionFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusSubmitted, ownerID)
	err := r.Reject(ownerID, "理由") // 所有者が自己却下
	if err != domain.ErrSelfApprovalNotAllowed {
		t.Fatalf("Reject() self: error = %v, want ErrSelfApprovalNotAllowed", err)
	}
}

// RPT-089: T4 — approved + 他ユーザー → MarkAsPaid() 成功。
// status=paid, paid_at/paid_by がセットされる。
func TestReport_MarkAsPaid_ApprovedSuccess(t *testing.T) {
	ownerID := uuid.New()
	actorID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)

	if err := r.MarkAsPaid(actorID); err != nil {
		t.Fatalf("MarkAsPaid() error = %v, want nil", err)
	}
	if r.Status != domain.ReportStatusPaid {
		t.Errorf("Status = %v, want paid", r.Status)
	}
	if r.PaidAt == nil {
		t.Error("PaidAt は nil 以外を期待するが nil だった")
	}
	if r.PaidBy == nil || *r.PaidBy != actorID {
		t.Errorf("PaidBy = %v, want %v", r.PaidBy, actorID)
	}
}

// RPT-090: T4 — 自己支払 → SelfPaymentNotAllowed エラー（RBC-012）。
func TestReport_MarkAsPaid_SelfPaymentFails(t *testing.T) {
	ownerID := uuid.New()
	r := newReport(domain.ReportStatusApproved, ownerID)
	err := r.MarkAsPaid(ownerID) // 所有者が自己支払
	if err != domain.ErrSelfPaymentNotAllowed {
		t.Fatalf("MarkAsPaid() self: error = %v, want ErrSelfPaymentNotAllowed", err)
	}
}
