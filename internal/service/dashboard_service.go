package service

import (
	"context"

	"expense-saas/internal/domain"
)

type dashboardService struct {
	reportRepo     domain.ReportRepository
	membershipRepo domain.MembershipRepository
}

// NewDashboardService は DashboardService を生成して返す。
func NewDashboardService(
	reportRepo domain.ReportRepository,
	membershipRepo domain.MembershipRepository,
) DashboardService {
	return &dashboardService{
		reportRepo:     reportRepo,
		membershipRepo: membershipRepo,
	}
}

func (s *dashboardService) GetDashboard(_ context.Context, _ domain.Actor) (*domain.DashboardData, error) {
	return nil, ErrNotImplemented
}
