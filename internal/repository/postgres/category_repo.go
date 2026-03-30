package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type categoryRepo struct {
	pool *pgxpool.Pool
}

// NewCategoryRepo constructs a CategoryRepository backed by PostgreSQL.
func NewCategoryRepo(pool *pgxpool.Pool) domain.CategoryRepository {
	return &categoryRepo{pool: pool}
}

func (r *categoryRepo) ListActive(ctx context.Context, tenantID uuid.UUID) ([]domain.Category, error) {
	q := queries(ctx, r.pool)
	rows, err := q.ListActiveCategories(ctx, toPgtypeUUID(&tenantID))
	if err != nil {
		return nil, fmt.Errorf("categoryRepo.ListActive: %w", err)
	}
	result := make([]domain.Category, len(rows))
	for i, row := range rows {
		c := categoryFromRow(row)
		result[i] = *c
	}
	return result, nil
}

func (r *categoryRepo) GetByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*domain.Category, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetCategoryByID(ctx, sqlcgen.GetCategoryByIDParams{
		CategoryID: categoryID,
		TenantID:   pgtype.UUID{Bytes: tenantID, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("categoryRepo.GetByID: %w", err)
	}
	return categoryFromRow(row), nil
}
