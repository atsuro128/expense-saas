package service

import (
	"context"

	"expense-saas/internal/domain"
)

type tenantService struct {
	tenantRepo     domain.TenantRepository
	userRepo       domain.UserRepository
	membershipRepo domain.MembershipRepository
}

// NewTenantService は TenantService を生成して返す。
func NewTenantService(
	tenantRepo domain.TenantRepository,
	userRepo domain.UserRepository,
	membershipRepo domain.MembershipRepository,
) TenantService {
	return &tenantService{
		tenantRepo:     tenantRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
	}
}

func (s *tenantService) GetTenant(_ context.Context, _ domain.Actor) (*domain.TenantInfoDTO, error) {
	return nil, ErrNotImplemented
}

func (s *tenantService) ListTenantMembers(_ context.Context, _ domain.Actor) ([]domain.UserSummary, error) {
	return nil, ErrNotImplemented
}
