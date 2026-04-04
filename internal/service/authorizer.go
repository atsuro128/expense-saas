package service

import (
	"expense-saas/internal/domain"
)

// Authorizer は所有権とビジネスルールに基づく認可チェックを担う。
// repository からリソースを取得した後、service メソッド内で使用する。
type Authorizer interface {
	// CanModifyReport は操作者がレポートを所有しているかを確認する（RBC-010）。
	CanModifyReport(actor domain.Actor, report *domain.ExpenseReport) error
	// CanViewReport は操作者がレポートを参照できるかを確認する（RBC-013, RBC-014, RBC-015）。
	CanViewReport(actor domain.Actor, report *domain.ExpenseReport) error
	// CanApproveOrReject は操作者が承認・却下できるか、かつ申請者本人でないかを確認する
	// （RBC-016 自己承認禁止）。
	CanApproveOrReject(actor domain.Actor, report *domain.ExpenseReport) error
	// CanMarkAsPaid は操作者が支払記録できるか、かつ申請者本人でないかを確認する
	// （RBC-012 自己支払禁止）。
	CanMarkAsPaid(actor domain.Actor, report *domain.ExpenseReport) error
}

// authorizerImpl は Authorizer のスタブ実装。
// ビジネスロジックが実装されるまで、全メソッドは ErrNotImplemented を返す。
type authorizerImpl struct{}

// NewAuthorizer はデフォルトの Authorizer を生成して返す。
func NewAuthorizer() Authorizer {
	return &authorizerImpl{}
}

func (a *authorizerImpl) CanModifyReport(_ domain.Actor, _ *domain.ExpenseReport) error {
	return ErrNotImplemented
}

func (a *authorizerImpl) CanViewReport(_ domain.Actor, _ *domain.ExpenseReport) error {
	return ErrNotImplemented
}

func (a *authorizerImpl) CanApproveOrReject(_ domain.Actor, _ *domain.ExpenseReport) error {
	return ErrNotImplemented
}

func (a *authorizerImpl) CanMarkAsPaid(_ domain.Actor, _ *domain.ExpenseReport) error {
	return ErrNotImplemented
}
