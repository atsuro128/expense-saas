package service

import (
	"context"

	"expense-saas/internal/domain"
)

type authService struct {
	userRepo         domain.UserRepository
	tenantRepo       domain.TenantRepository
	membershipRepo   domain.MembershipRepository
	refreshTokenRepo domain.RefreshTokenRepository
	passwordRepo     domain.PasswordResetTokenRepository
}

// NewAuthService は AuthService を生成して返す。
func NewAuthService(
	userRepo domain.UserRepository,
	tenantRepo domain.TenantRepository,
	membershipRepo domain.MembershipRepository,
	refreshTokenRepo domain.RefreshTokenRepository,
	passwordRepo domain.PasswordResetTokenRepository,
) AuthService {
	return &authService{
		userRepo:         userRepo,
		tenantRepo:       tenantRepo,
		membershipRepo:   membershipRepo,
		refreshTokenRepo: refreshTokenRepo,
		passwordRepo:     passwordRepo,
	}
}

func (s *authService) Signup(_ context.Context, _ SignupParams) (*domain.AuthResult, error) {
	return nil, ErrNotImplemented
}

func (s *authService) Login(_ context.Context, _, _ string) (*domain.AuthResult, error) {
	return nil, ErrNotImplemented
}

func (s *authService) RefreshToken(_ context.Context, _ string) (*domain.AuthResult, error) {
	return nil, ErrNotImplemented
}

func (s *authService) Logout(_ context.Context, _ string) error {
	return ErrNotImplemented
}

func (s *authService) GetMe(_ context.Context, _ domain.Actor) (*domain.UserProfile, error) {
	return nil, ErrNotImplemented
}

func (s *authService) RequestPasswordReset(_ context.Context, _ string) error {
	return ErrNotImplemented
}

func (s *authService) ExecutePasswordReset(_ context.Context, _, _ string) error {
	return ErrNotImplemented
}
