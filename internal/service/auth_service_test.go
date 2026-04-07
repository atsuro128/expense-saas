package service_test

import (
	"context"
	"testing"

	"expense-saas/internal/service"
	"expense-saas/internal/testutil"
)

// =============================================================================
// AuthService 統合テスト
// サービス層単体では認証ロジックはドメイン/ハンドラ層に委譲するため、
// ここではサービスインターフェースの基本的な動作確認を行う。
// =============================================================================

// TestAuthService_Signup_NotImplemented: サービス層 Signup が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Signup_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	_, err := svc.Signup(context.Background(), service.SignupParams{
		CompanyName: "Test Corp",
		Email:       "new@example.com",
		Name:        "Test User",
		Password:    "TestPass1!",
	})
	if err == nil {
		t.Fatal("Signup は未実装ですがエラーを返しませんでした")
	}
}

// TestAuthService_Login_NotImplemented: サービス層 Login が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Login_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	_, err := svc.Login(context.Background(), "test-admin@example.com", "TestPass1!")
	if err == nil {
		t.Fatal("Login は未実装ですがエラーを返しませんでした")
	}
}

// TestAuthService_RefreshToken_NotImplemented: サービス層 RefreshToken が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_RefreshToken_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	_, err := svc.RefreshToken(context.Background(), "some.refresh.token")
	if err == nil {
		t.Fatal("RefreshToken は未実装ですがエラーを返しませんでした")
	}
}

// TestAuthService_Logout_NotImplemented: サービス層 Logout が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Logout_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	err := svc.Logout(context.Background(), "some.refresh.token")
	if err == nil {
		t.Fatal("Logout は未実装ですがエラーを返しませんでした")
	}
}

// TestAuthService_RequestPasswordReset_NotImplemented: サービス層 RequestPasswordReset が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_RequestPasswordReset_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	err := svc.RequestPasswordReset(context.Background(), "test-admin@example.com")
	if err == nil {
		t.Fatal("RequestPasswordReset は未実装ですがエラーを返しませんでした")
	}
}

// TestAuthService_ExecutePasswordReset_NotImplemented: サービス層 ExecutePasswordReset が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_ExecutePasswordReset_NotImplemented(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	svc := buildAuthService(t, pool)

	err := svc.ExecutePasswordReset(context.Background(), "valid-token", "NewPass1!")
	if err == nil {
		t.Fatal("ExecutePasswordReset は未実装ですがエラーを返しませんでした")
	}
}
