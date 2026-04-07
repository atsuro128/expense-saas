package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type workflowService struct {
	reportRepo     domain.ReportRepository
	userRepo       domain.UserRepository
	membershipRepo domain.MembershipRepository
	authorizer     Authorizer
}

// NewWorkflowService は WorkflowService を生成して返す。
func NewWorkflowService(
	reportRepo domain.ReportRepository,
	userRepo domain.UserRepository,
	membershipRepo domain.MembershipRepository,
	authorizer Authorizer,
) WorkflowService {
	return &workflowService{
		reportRepo:     reportRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
		authorizer:     authorizer,
	}
}

func (s *workflowService) ListPendingReports(_ context.Context, _ domain.Actor, _ domain.WorkflowListParams) ([]domain.PendingReport, *domain.Pagination, error) {
	return nil, nil, ErrNotImplemented
}

func (s *workflowService) ApproveReport(_ context.Context, _ domain.Actor, _ uuid.UUID, _ *string, _ time.Time) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}

func (s *workflowService) RejectReport(_ context.Context, _ domain.Actor, _ uuid.UUID, _ string, _ time.Time) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}

func (s *workflowService) ListPayableReports(_ context.Context, _ domain.Actor, _ domain.WorkflowListParams) ([]domain.PayableReport, *domain.Pagination, error) {
	return nil, nil, ErrNotImplemented
}

func (s *workflowService) MarkReportAsPaid(_ context.Context, _ domain.Actor, _ uuid.UUID, _ time.Time) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}
