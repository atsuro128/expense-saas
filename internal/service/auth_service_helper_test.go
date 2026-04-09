package service_test

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
	"expense-saas/internal/testutil"
)

// buildAuthService はテスト用 DB を使用する AuthService を生成して返すヘルパー。
// Step 10 で統合テストが本実装に切り替わる際に使用する。
//
//lint:ignore U1000 Step 10 で使用予定
func buildAuthService(t *testing.T, pool *pgxpool.Pool) service.AuthService {
	t.Helper()

	userRepo := postgres.NewUserRepo(pool)
	tenantRepo := postgres.NewTenantRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	// テスト用 RSA 鍵ペアを使用する。
	kp := testutil.GenerateTestKeyPair(t)
	hasher := domain.NewArgon2idHasher()
	tokenGen := domain.NewJWTGenerator(kp.PrivateKey)
	tokenVerifier := domain.NewJWTVerifier(kp.PublicKey)

	return service.NewAuthService(pool, userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo, hasher, tokenGen, tokenVerifier)
}
