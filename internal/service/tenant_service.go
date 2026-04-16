package service

import (
	"context"
	"errors"
	"fmt"

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

// GetTenant は actor のテナント情報を返す（Admin 専用）。
func (s *tenantService) GetTenant(ctx context.Context, actor domain.Actor) (*TenantInfoDTO, error) {
	tenant, err := s.tenantRepo.GetByID(ctx, actor.TenantID)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("tenantService.GetTenant: %w", err)
	}
	return &TenantInfoDTO{
		ID:        tenant.TenantID,
		Name:      tenant.CompanyName,
		CreatedAt: tenant.CreatedAt,
	}, nil
}

// ListTenantMembers は actor のテナントに所属する全メンバーの UserSummary 一覧を返す。
func (s *tenantService) ListTenantMembers(ctx context.Context, actor domain.Actor) ([]UserSummary, error) {
	memberships, err := s.membershipRepo.ListByTenantID(ctx, actor.TenantID)
	if err != nil {
		return nil, fmt.Errorf("tenantService.ListTenantMembers: %w", err)
	}

	summaries := make([]UserSummary, 0, len(memberships))
	for _, m := range memberships {
		user, err := s.userRepo.GetByID(ctx, m.UserID)
		if err != nil {
			return nil, fmt.Errorf("tenantService.ListTenantMembers: get user %s: %w", m.UserID, err)
		}
		summaries = append(summaries, UserSummary{
			ID:   user.UserID,
			Name: user.Name,
		})
	}
	return summaries, nil
}
