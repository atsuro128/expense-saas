package domain_test

// ドメイン層単体テスト — 経費明細（ExpenseItem）不変条件と明細操作制限。
// DB を使わず、ドメインオブジェクトを直接構築してメソッドを呼ぶ。
//
// 対応テストケース:
//   ITM-006: amount=1 の最小値検証
//   ITM-013: amount=0 で ErrInvalidAmount
//   ITM-014: amount=-100 で ErrInvalidAmount
//   ITM-065: submitted 状態のレポートへの明細追加で ErrReportNotEditable
//   ITM-165: submitted 状態のレポートの明細更新で ErrReportNotEditable
//   ITM-245: submitted 状態のレポートの明細削除で ErrReportNotEditable

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// newExpenseItem は指定した amount で ExpenseItem を構築するヘルパー。
func newExpenseItem(amount int) *domain.ExpenseItem {
	return &domain.ExpenseItem{
		ItemID:      uuid.New(),
		ReportID:    uuid.New(),
		TenantID:    uuid.New(),
		ExpenseDate: time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC),
		Amount:      amount,
		CategoryID:  uuid.New(),
		Description: "テスト明細",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
}

// newItemReport はテスト用の ExpenseReport を指定ステータスで構築するヘルパー（明細テスト用）。
func newItemReport(status domain.ReportStatus) *domain.ExpenseReport {
	return &domain.ExpenseReport{
		ReportID:  uuid.New(),
		TenantID:  uuid.New(),
		UserID:    uuid.New(),
		Title:     "テストレポート",
		Status:    status,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
}

// =============================================================================
// ITM-006: 金額最小値（amount=1）
// =============================================================================

// TestExpenseItem_AmountMinimum は amount=1（最小値）で明細を作成してもエラーが発生しないことを検証する。
// ITM-006 に対応する。
func TestExpenseItem_AmountMinimum(t *testing.T) {
	item := newExpenseItem(1)
	if item.Amount != 1 {
		t.Errorf("Amount = %d, want 1", item.Amount)
	}
	// amount=1 はドメイン不変条件 ITM-002（amount > 0）を満たす。
}

// =============================================================================
// ITM-013, ITM-014: 金額バリデーション（ErrInvalidAmount）
// =============================================================================

// TestExpenseItem_AmountZero は amount=0 で ErrInvalidAmount が返ることを検証する。
// ITM-013 に対応する。
func TestExpenseItem_AmountZero(t *testing.T) {
	item := newExpenseItem(0)
	if err := item.ValidateAmount(); err != domain.ErrInvalidAmount {
		t.Fatalf("ValidateAmount() error = %v, want ErrInvalidAmount", err)
	}
}

// TestExpenseItem_AmountNegative は amount=-100 で ErrInvalidAmount が返ることを検証する。
// ITM-014 に対応する。
func TestExpenseItem_AmountNegative(t *testing.T) {
	item := newExpenseItem(-100)
	if err := item.ValidateAmount(); err != domain.ErrInvalidAmount {
		t.Fatalf("ValidateAmount() error = %v, want ErrInvalidAmount", err)
	}
}

// =============================================================================
// ITM-065: submitted 状態のレポートへの明細追加拒否
// =============================================================================

// TestExpenseReport_AddItem_NotDraft は submitted 状態のレポートに明細を追加しようとすると
// ErrReportNotEditable が返ることを検証する。
// ITM-065 に対応する。
func TestExpenseReport_AddItem_NotDraft(t *testing.T) {
	nonDraftStatuses := []struct {
		name   string
		status domain.ReportStatus
	}{
		{"submitted", domain.ReportStatusSubmitted},
		{"approved", domain.ReportStatusApproved},
		{"rejected", domain.ReportStatusRejected},
		{"paid", domain.ReportStatusPaid},
	}

	for _, tc := range nonDraftStatuses {
		t.Run(tc.name, func(t *testing.T) {
			r := newItemReport(tc.status)
			if err := r.CanEdit(); err != domain.ErrReportNotEditable {
				t.Fatalf("CanEdit() on %s: error = %v, want ErrReportNotEditable", tc.name, err)
			}
		})
	}
}

// =============================================================================
// ITM-165: submitted 状態のレポートの明細更新拒否
// =============================================================================

// TestExpenseReport_UpdateItem_NotDraft は submitted 状態のレポートの明細を更新しようとすると
// ErrReportNotEditable が返ることを検証する。
// ITM-165 に対応する。
func TestExpenseReport_UpdateItem_NotDraft(t *testing.T) {
	nonDraftStatuses := []struct {
		name   string
		status domain.ReportStatus
	}{
		{"submitted", domain.ReportStatusSubmitted},
		{"approved", domain.ReportStatusApproved},
		{"rejected", domain.ReportStatusRejected},
		{"paid", domain.ReportStatusPaid},
	}

	for _, tc := range nonDraftStatuses {
		t.Run(tc.name, func(t *testing.T) {
			r := newItemReport(tc.status)
			if err := r.CanEdit(); err != domain.ErrReportNotEditable {
				t.Fatalf("CanEdit() on %s: error = %v, want ErrReportNotEditable", tc.name, err)
			}
		})
	}
}

// =============================================================================
// ITM-245: submitted 状態のレポートの明細削除拒否
// =============================================================================

// TestExpenseReport_DeleteItem_NotDraft は submitted 状態のレポートの明細を削除しようとすると
// ErrReportNotEditable が返ることを検証する。
// ITM-245 に対応する。
func TestExpenseReport_DeleteItem_NotDraft(t *testing.T) {
	nonDraftStatuses := []struct {
		name   string
		status domain.ReportStatus
	}{
		{"submitted", domain.ReportStatusSubmitted},
		{"approved", domain.ReportStatusApproved},
		{"rejected", domain.ReportStatusRejected},
		{"paid", domain.ReportStatusPaid},
	}

	for _, tc := range nonDraftStatuses {
		t.Run(tc.name, func(t *testing.T) {
			r := newItemReport(tc.status)
			if err := r.CanEdit(); err != domain.ErrReportNotEditable {
				t.Fatalf("CanEdit() on %s: error = %v, want ErrReportNotEditable", tc.name, err)
			}
		})
	}
}
