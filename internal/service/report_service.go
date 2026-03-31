package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type reportService struct {
	reportRepo     domain.ReportRepository
	userRepo       domain.UserRepository
	membershipRepo domain.MembershipRepository
	itemRepo       domain.ItemRepository
	categoryRepo   domain.CategoryRepository
	attachmentRepo domain.AttachmentRepository
	authorizer     Authorizer
}

// NewReportService constructs a ReportService.
func NewReportService(
	reportRepo domain.ReportRepository,
	userRepo domain.UserRepository,
	membershipRepo domain.MembershipRepository,
	itemRepo domain.ItemRepository,
	categoryRepo domain.CategoryRepository,
	attachmentRepo domain.AttachmentRepository,
	authorizer Authorizer,
) ReportService {
	return &reportService{
		reportRepo:     reportRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
		itemRepo:       itemRepo,
		categoryRepo:   categoryRepo,
		attachmentRepo: attachmentRepo,
		authorizer:     authorizer,
	}
}

func (s *reportService) CreateReport(_ context.Context, _ domain.Actor, _ CreateReportParams) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}

func (s *reportService) GetReport(_ context.Context, _ domain.Actor, _ uuid.UUID) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}

func (s *reportService) ListMyReports(_ context.Context, _ domain.Actor, _ domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error) {
	return nil, nil, ErrNotImplemented
}

func (s *reportService) ListAllReports(_ context.Context, _ domain.Actor, _ domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error) {
	return nil, nil, ErrNotImplemented
}

func (s *reportService) UpdateReport(_ context.Context, _ domain.Actor, _ uuid.UUID, _ UpdateReportParams) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}

func (s *reportService) DeleteReport(_ context.Context, _ domain.Actor, _ uuid.UUID) error {
	return ErrNotImplemented
}

func (s *reportService) SubmitReport(_ context.Context, _ domain.Actor, _ uuid.UUID, _ time.Time) (*domain.ExpenseReportDetail, error) {
	return nil, ErrNotImplemented
}
