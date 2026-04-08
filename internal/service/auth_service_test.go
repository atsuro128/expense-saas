package service_test

import (
	"context"
	"errors"
	"testing"

	"expense-saas/internal/service"
)

// =============================================================================
// AuthService スタブ検証テスト
// 現時点ではサービス層の全メソッドが ErrNotImplemented を返すスタブ実装。
// DB 接続なしで ErrNotImplemented が返ることを確認する。
// =============================================================================

// TestAuthService_Signup_NotImplemented: サービス層 Signup が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Signup_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	_, err := svc.Signup(context.Background(), service.SignupParams{
		CompanyName: "Test Corp",
		Email:       "new@example.com",
		Name:        "Test User",
		Password:    "TestPass1!",
	})
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("Signup: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}

// TestAuthService_Login_NotImplemented: サービス層 Login が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Login_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	_, err := svc.Login(context.Background(), "test-admin@example.com", "TestPass1!")
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("Login: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}

// TestAuthService_RefreshToken_NotImplemented: サービス層 RefreshToken が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_RefreshToken_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	_, err := svc.RefreshToken(context.Background(), "some.refresh.token")
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("RefreshToken: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}

// TestAuthService_Logout_NotImplemented: サービス層 Logout が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_Logout_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	err := svc.Logout(context.Background(), "some.refresh.token")
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("Logout: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}

// TestAuthService_RequestPasswordReset_NotImplemented: サービス層 RequestPasswordReset が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_RequestPasswordReset_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	err := svc.RequestPasswordReset(context.Background(), "test-admin@example.com")
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("RequestPasswordReset: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}

// TestAuthService_ExecutePasswordReset_NotImplemented: サービス層 ExecutePasswordReset が現時点で ErrNotImplemented を返すことを確認する。
func TestAuthService_ExecutePasswordReset_NotImplemented(t *testing.T) {
	svc := buildAuthServiceWithoutDB(t)

	err := svc.ExecutePasswordReset(context.Background(), "valid-token", "NewPass1!")
	if !errors.Is(err, service.ErrNotImplemented) {
		t.Fatalf("ExecutePasswordReset: ErrNotImplemented を期待しましたが、%v が返りました", err)
	}
}
