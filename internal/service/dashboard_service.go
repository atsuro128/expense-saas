package service

import (
	"context"

	"expense-saas/internal/domain"
)

type dashboardService struct {
	reportRepo     domain.ReportRepository
	membershipRepo domain.MembershipRepository
}

// NewDashboardService constructs a DashboardService.
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
