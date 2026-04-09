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

// authorizerImpl は Authorizer の本実装。
type authorizerImpl struct{}

// NewAuthorizer はデフォルトの Authorizer を生成して返す。
func NewAuthorizer() Authorizer {
	return &authorizerImpl{}
}

// CanModifyReport は操作者がレポートの所有者かを確認する（RBC-010）。
// 所有者以外は ErrForbidden を返す。
func (a *authorizerImpl) CanModifyReport(actor domain.Actor, report *domain.ExpenseReport) error {
	if actor.UserID != report.UserID {
		return domain.ErrForbidden
	}
	return nil
}

// CanViewReport は操作者がレポートを参照できるかをロールに応じて確認する。
//
// - Member: 自分のレポートのみ参照可（RBC-010）
// - Approver: 自分のレポート + submitted 状態のレポート + 自分が承認/却下したレポート（RBC-011, SS10.3）
// - Accounting / Admin: テナント内全レポート参照可（RBC-013, RBC-015）
func (a *authorizerImpl) CanViewReport(actor domain.Actor, report *domain.ExpenseReport) error {
	// 自分のレポートは常に参照可能。
	if actor.UserID == report.UserID {
		return nil
	}

	switch actor.Role {
	case domain.RoleAdmin, domain.RoleAccounting:
		// テナント内全レポート参照可。
		return nil
	case domain.RoleApprover:
		// submitted 状態の他者レポートは参照可（RBC-011）。
		if report.Status == domain.ReportStatusSubmitted {
			return nil
		}
		// 自分が承認したレポートは参照可（SS10.3 authz.md）。
		if report.ApprovedBy != nil && *report.ApprovedBy == actor.UserID {
			return nil
		}
		// 自分が却下したレポートは参照可（SS10.3 authz.md）。
		if report.RejectedBy != nil && *report.RejectedBy == actor.UserID {
			return nil
		}
		return domain.ErrForbidden
	default:
		// Member は自分のレポートのみ。
		return domain.ErrForbidden
	}
}

// CanApproveOrReject は操作者が申請者本人でないかを確認する（RBC-016 自己承認禁止）。
// 自己承認の場合は ErrSelfApprovalNotAllowed を返す。
func (a *authorizerImpl) CanApproveOrReject(actor domain.Actor, report *domain.ExpenseReport) error {
	if actor.UserID == report.UserID {
		return domain.ErrSelfApprovalNotAllowed
	}
	return nil
}

// CanMarkAsPaid は操作者が申請者本人でないかを確認する（RBC-012 自己支払禁止）。
// 自己支払の場合は ErrSelfPaymentNotAllowed を返す。
func (a *authorizerImpl) CanMarkAsPaid(actor domain.Actor, report *domain.ExpenseReport) error {
	if actor.UserID == report.UserID {
		return domain.ErrSelfPaymentNotAllowed
	}
	return nil
}
