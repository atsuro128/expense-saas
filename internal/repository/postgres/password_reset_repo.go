package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type passwordResetRepo struct {
	pool *pgxpool.Pool
}

// NewPasswordResetRepo constructs a PasswordResetTokenRepository backed by PostgreSQL.
func NewPasswordResetRepo(pool *pgxpool.Pool) domain.PasswordResetTokenRepository {
	return &passwordResetRepo{pool: pool}
}

func (r *passwordResetRepo) Create(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*domain.PasswordResetToken, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreatePasswordResetToken(ctx, sqlcgen.CreatePasswordResetTokenParams{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("passwordResetRepo.Create: %w", err)
	}
	return passwordResetTokenFromRow(row), nil
}

func (r *passwordResetRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*domain.PasswordResetToken, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetPasswordResetTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("passwordResetRepo.GetByTokenHash: %w", err)
	}
	return passwordResetTokenFromRow(row), nil
}

func (r *passwordResetRepo) MarkUsed(ctx context.Context, id uuid.UUID) error {
	q := queries(ctx, r.pool)
	if err := q.MarkPasswordResetTokenUsed(ctx, id); err != nil {
		return fmt.Errorf("passwordResetRepo.MarkUsed: %w", err)
	}
	return nil
}
