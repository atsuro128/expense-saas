package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
)

type tenantRepo struct {
	pool *pgxpool.Pool
}

// NewTenantRepo constructs a TenantRepository backed by PostgreSQL.
func NewTenantRepo(pool *pgxpool.Pool) domain.TenantRepository {
	return &tenantRepo{pool: pool}
}

func (r *tenantRepo) Create(ctx context.Context, companyName string) (*domain.Tenant, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateTenant(ctx, companyName)
	if err != nil {
		return nil, fmt.Errorf("tenantRepo.Create: %w", err)
	}
	return tenantFromRow(row), nil
}

func (r *tenantRepo) GetByID(ctx context.Context, tenantID uuid.UUID) (*domain.Tenant, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetTenantByID(ctx, tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("tenantRepo.GetByID: %w", err)
	}
	return tenantFromRow(row), nil
}
