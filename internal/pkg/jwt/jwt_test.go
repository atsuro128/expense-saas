package jwt_test

// pkg/jwt.Verifier（middleware 経路）の leeway テスト。
// domain.JWTVerifier（service 経路）の AUTH-081〜088 に対応する middleware 経路版。
// テスト ID: AUTH-089〜092（auth.md §1.2）。

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	pkgjwt "expense-saas/internal/pkg/jwt"
)

const (
	testKid       = "expense-saas-key-1"
	testUserIDStr = "aaaaaaaa-1111-1111-1111-000000000001"
	testTenantID  = "aaaaaaaa-0001-0001-0001-000000000001"
	testRole      = "admin"
)

// generateRSAKey はテスト用 RSA 2048 ビット鍵ペアを生成するヘルパー。
func generateRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("RSA 鍵生成に失敗しました: %v", err)
	}
	return priv
}

// makeAccessTokenWithClaims は iat / exp を直接指定してアクセストークンを生成するヘルパー。
// pkg/jwt.Verifier の leeway テスト用に時刻を任意設定できる。
func makeAccessTokenWithClaims(t *testing.T, priv *rsa.PrivateKey, iat, exp time.Time) string {
	t.Helper()
	type testClaims struct {
		TenantID  string `json:"tenant_id"`
		Role      string `json:"role"`
		TokenType string `json:"token_type"`
		gojwt.RegisteredClaims
	}
	claims := testClaims{
		TenantID:  testTenantID,
		Role:      testRole,
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   testUserIDStr,
			IssuedAt:  gojwt.NewNumericDate(iat),
			ExpiresAt: gojwt.NewNumericDate(exp),
			ID:        uuid.New().String(),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	tok.Header["kid"] = testKid
	signed, err := tok.SignedString(priv)
	if err != nil {
		t.Fatalf("アクセストークン署名に失敗しました: %v", err)
	}
	return signed
}

// =============================================================================
// AUTH-089〜092: pkg/jwt.Verifier（middleware 経路）の leeway 60 秒テスト
// domain.JWTVerifier（service 経路、AUTH-081〜088）と同じ leeway 仕様が
// middleware 経路にも適用されていることを確認する（issue #173）。
// =============================================================================

// AUTH-089: アクセストークンの iat が 30 秒未来でも leeway 内なので検証が成功すること。
func TestVerify_IatFuture30s_Allowed(t *testing.T) {
	// AUTH-089
	priv := generateRSAKey(t)
	v := pkgjwt.NewVerifierFromKey(&priv.PublicKey, testKid)

	now := time.Now()
	// iat を 30 秒未来に設定する（leeway 60 秒以内なので許容される）。
	iat := now.Add(30 * time.Second)
	exp := now.Add(15 * time.Minute)
	signed := makeAccessTokenWithClaims(t, priv, iat, exp)

	claims, err := v.Verify(signed)
	if err != nil {
		t.Errorf("iat=now+30s は leeway 内のため成功を期待しましたが got: %v", err)
	}
	if claims != nil && claims.UserID != testUserIDStr {
		t.Errorf("UserID が期待値と異なります: got %v, want %v", claims.UserID, testUserIDStr)
	}
}

// AUTH-090: アクセストークンの iat が 61 秒未来の場合 leeway を超えるため検証エラーが返ること。
func TestVerify_IatFuture61s_Rejected(t *testing.T) {
	// AUTH-090
	priv := generateRSAKey(t)
	v := pkgjwt.NewVerifierFromKey(&priv.PublicKey, testKid)

	now := time.Now()
	// iat を 61 秒未来に設定する（leeway 60 秒を超えるため拒否される）。
	iat := now.Add(61 * time.Second)
	exp := now.Add(15 * time.Minute)
	signed := makeAccessTokenWithClaims(t, priv, iat, exp)

	_, err := v.Verify(signed)
	if err == nil {
		t.Error("iat=now+61s は leeway 超過のためエラーを期待しましたが nil が返りました")
	}
}

// AUTH-091: アクセストークンの exp が 30 秒過去でも leeway 内なので検証が成功すること。
func TestVerify_ExpPast30s_Allowed(t *testing.T) {
	// AUTH-091
	priv := generateRSAKey(t)
	v := pkgjwt.NewVerifierFromKey(&priv.PublicKey, testKid)

	now := time.Now()
	// exp を 30 秒過去に設定する（leeway 60 秒以内なので許容される）。
	iat := now.Add(-15 * time.Minute)
	exp := now.Add(-30 * time.Second)
	signed := makeAccessTokenWithClaims(t, priv, iat, exp)

	claims, err := v.Verify(signed)
	if err != nil {
		t.Errorf("exp=now-30s は leeway 内のため成功を期待しましたが got: %v", err)
	}
	if claims != nil && claims.UserID != testUserIDStr {
		t.Errorf("UserID が期待値と異なります: got %v, want %v", claims.UserID, testUserIDStr)
	}
}

// AUTH-092: アクセストークンの exp が 61 秒過去の場合 leeway を超えるため ErrTokenExpired 相当のエラーが返ること。
func TestVerify_ExpPast61s_Rejected(t *testing.T) {
	// AUTH-092
	priv := generateRSAKey(t)
	v := pkgjwt.NewVerifierFromKey(&priv.PublicKey, testKid)

	now := time.Now()
	// exp を 61 秒過去に設定する（leeway 60 秒を超えるため拒否される）。
	iat := now.Add(-15 * time.Minute)
	exp := now.Add(-61 * time.Second)
	signed := makeAccessTokenWithClaims(t, priv, iat, exp)

	_, err := v.Verify(signed)
	if err == nil {
		t.Fatal("exp=now-61s は leeway 超過のためエラーを期待しましたが nil が返りました")
	}
	// golang-jwt/v5 では期限切れは ErrTokenExpired でラップされる。
	if !errors.Is(err, gojwt.ErrTokenExpired) {
		t.Errorf("ErrTokenExpired を期待しましたが got: %v", err)
	}
}
