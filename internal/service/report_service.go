package service

import (
	"context"
	"fmt"
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

// NewReportService は ReportService を生成して返す。
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

// ListAllReports はテナント内の全レポートを一覧取得する（Admin / Accounting 専用）。
func (s *reportService) ListAllReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error) {
	// PerPage のデフォルト値を設定する。
	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	params.Page = page
	params.PerPage = perPage

	// UserID フィルタなし（全レポート対象）でリポジトリを呼び出す。
	reports, total, err := s.reportRepo.List(ctx, actor.TenantID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("reportService.ListAllReports: %w", err)
	}

	// 各レポートの提出者情報を取得して ExpenseReportSummary に変換する。
	summaries := make([]domain.ExpenseReportSummary, 0, len(reports))
	for _, rpt := range reports {
		summary := domain.ExpenseReportSummary{
			ID:          rpt.ReportID,
			Title:       rpt.Title,
			PeriodStart: rpt.PeriodStart,
			PeriodEnd:   rpt.PeriodEnd,
			Status:      rpt.Status,
			TotalAmount: rpt.TotalAmount,
			SubmittedAt: rpt.SubmittedAt,
			CreatedAt:   rpt.CreatedAt,
			UpdatedAt:   rpt.UpdatedAt,
		}

		// 提出者（Submitter）を設定する。
		user, err := s.userRepo.GetByID(ctx, rpt.UserID)
		if err != nil {
			return nil, nil, fmt.Errorf("reportService.ListAllReports: get submitter %s: %w", rpt.UserID, err)
		}
		summary.Submitter = &domain.UserSummary{
			ID:   user.UserID,
			Name: user.Name,
		}

		summaries = append(summaries, summary)
	}

	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}

	pagination := &domain.Pagination{
		CurrentPage: page,
		PerPage:     perPage,
		TotalCount:  total,
		TotalPages:  totalPages,
	}

	return summaries, pagination, nil
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
