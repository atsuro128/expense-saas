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

type refreshTokenRepo struct {
	pool *pgxpool.Pool
}

// NewRefreshTokenRepo は PostgreSQL をバックエンドとする RefreshTokenRepository を生成して返す。
func NewRefreshTokenRepo(pool *pgxpool.Pool) domain.RefreshTokenRepository {
	return &refreshTokenRepo{pool: pool}
}

func (r *refreshTokenRepo) Create(ctx context.Context, jti, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*domain.RefreshToken, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateRefreshToken(ctx, sqlcgen.CreateRefreshTokenParams{
		Jti:       jti,
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("refreshTokenRepo.Create: %w", err)
	}
	return refreshTokenFromRow(row), nil
}

func (r *refreshTokenRepo) GetByJTI(ctx context.Context, jti uuid.UUID) (*domain.RefreshToken, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetRefreshTokenByJTI(ctx, jti)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("refreshTokenRepo.GetByJTI: %w", err)
	}
	return refreshTokenFromRow(row), nil
}

func (r *refreshTokenRepo) Revoke(ctx context.Context, jti uuid.UUID) error {
	q := queries(ctx, r.pool)
	if err := q.RevokeRefreshToken(ctx, jti); err != nil {
		return fmt.Errorf("refreshTokenRepo.Revoke: %w", err)
	}
	return nil
}

// RevokeAllByUserID は指定ユーザーの全リフレッシュトークンを失効済みにする。
// パスワードリセット後の強制ログアウトに使用する（security.md §2.3）。
func (r *refreshTokenRepo) RevokeAllByUserID(ctx context.Context, userID uuid.UUID) error {
	// sqlcgen に対応クエリがないため pool を直接使用する。
	conn := r.pool
	_, err := conn.Exec(ctx,
		`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("refreshTokenRepo.RevokeAllByUserID: %w", err)
	}
	return nil
}
