package service

import (
	"expense-saas/internal/domain"
)

// Authorizer enforces ownership and business-rule authorization checks.
// It is used by service methods after the resource has been fetched from the repository.
type Authorizer interface {
	// CanModifyReport checks that the actor owns the report (RBC-010).
	CanModifyReport(actor domain.Actor, report *domain.ExpenseReport) error
	// CanViewReport checks that the actor is allowed to read the report (RBC-013, RBC-014, RBC-015).
	CanViewReport(actor domain.Actor, report *domain.ExpenseReport) error
	// CanApproveOrReject checks that the actor may approve/reject the report
	// and that they are not the submitter (RBC-016 self-approval prohibition).
	CanApproveOrReject(actor domain.Actor, report *domain.ExpenseReport) error
	// CanMarkAsPaid checks that the actor may record payment
	// and that they are not the submitter (RBC-012 self-payment prohibition).
	CanMarkAsPaid(actor domain.Actor, report *domain.ExpenseReport) error
}

// authorizerImpl is a stub implementation of Authorizer.
// All methods return ErrNotImplemented until full business logic is wired.
type authorizerImpl struct{}

// NewAuthorizer constructs the default Authorizer.
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
