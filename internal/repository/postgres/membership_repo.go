package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type membershipRepo struct {
	pool *pgxpool.Pool
}

// NewMembershipRepo constructs a MembershipRepository backed by PostgreSQL.
func NewMembershipRepo(pool *pgxpool.Pool) domain.MembershipRepository {
	return &membershipRepo{pool: pool}
}

func (r *membershipRepo) Create(ctx context.Context, tenantID, userID uuid.UUID, role domain.Role) (*domain.TenantMembership, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateMembership(ctx, sqlcgen.CreateMembershipParams{
		TenantID: tenantID,
		UserID:   userID,
		Role:     string(role),
	})
	if err != nil {
		return nil, fmt.Errorf("membershipRepo.Create: %w", err)
	}
	return membershipFromRow(row), nil
}

func (r *membershipRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.TenantMembership, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetMembershipByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("membershipRepo.GetByUserID: %w", err)
	}
	return membershipFromRow(row), nil
}

func (r *membershipRepo) ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]domain.TenantMembership, error) {
	q := queries(ctx, r.pool)
	rows, err := q.ListMembershipsByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("membershipRepo.ListByTenantID: %w", err)
	}
	result := make([]domain.TenantMembership, len(rows))
	for i, row := range rows {
		m := membershipFromRow(row)
		result[i] = *m
	}
	return result, nil
}

func (r *membershipRepo) HasApprover(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	q := queries(ctx, r.pool)
	has, err := q.HasApprover(ctx, tenantID)
	if err != nil {
		return false, fmt.Errorf("membershipRepo.HasApprover: %w", err)
	}
	return has, nil
}
