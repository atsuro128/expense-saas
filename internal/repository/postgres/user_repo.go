package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type userRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo constructs a UserRepository backed by PostgreSQL.
func NewUserRepo(pool *pgxpool.Pool) domain.UserRepository {
	return &userRepo{pool: pool}
}

func (r *userRepo) Create(ctx context.Context, email, name, passwordHash string) (*domain.User, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateUser(ctx, sqlcgen.CreateUserParams{
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, domain.ErrEmailAlreadyExists
		}
		return nil, fmt.Errorf("userRepo.Create: %w", err)
	}
	return userFromRow(row), nil
}

func (r *userRepo) GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("userRepo.GetByID: %w", err)
	}
	return userFromRow(row), nil
}

func (r *userRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("userRepo.GetByEmail: %w", err)
	}
	return userFromRow(row), nil
}

func (r *userRepo) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	q := queries(ctx, r.pool)
	if err := q.UpdateUserPassword(ctx, sqlcgen.UpdateUserPasswordParams{
		UserID:       userID,
		PasswordHash: passwordHash,
	}); err != nil {
		return fmt.Errorf("userRepo.UpdatePassword: %w", err)
	}
	return nil
}
