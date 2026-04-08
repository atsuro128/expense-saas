package service_test

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
)

// buildAuthService はテスト用 DB を使用する AuthService を生成して返すヘルパー。
func buildAuthService(t *testing.T, pool *pgxpool.Pool) service.AuthService {
	t.Helper()

	userRepo := postgres.NewUserRepo(pool)
	tenantRepo := postgres.NewTenantRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	return service.NewAuthService(userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo)
}

// buildAuthServiceWithoutDB は DB 接続なしで AuthService を生成して返すヘルパー。
// 全メソッドが ErrNotImplemented を返すスタブ実装の検証に使用する。
// リポジトリは一切呼び出されないため nil を渡しても安全。
func buildAuthServiceWithoutDB(t *testing.T) service.AuthService {
	t.Helper()
	return service.NewAuthService(nil, nil, nil, nil, nil)
}
