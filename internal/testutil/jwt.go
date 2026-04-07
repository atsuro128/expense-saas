package testutil

import (
	"crypto/rand"
	"crypto/rsa"
	"sync"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"

	appjwt "expense-saas/internal/pkg/jwt"
)

// TestKeyPair はテスト専用のインメモリ RSA 鍵ペアを保持する。
type TestKeyPair struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

var (
	sharedKeyPairOnce sync.Once
	sharedKeyPair     *TestKeyPair
)

// GenerateTestKeyPair はパッケージレベルのシングルトン RSA 2048 ビット鍵ペアを返す。
// 鍵ペアは sync.Once でテストバイナリ実行ごとに一度だけ生成される。
func GenerateTestKeyPair(t *testing.T) *TestKeyPair {
	t.Helper()

	sharedKeyPairOnce.Do(func() {
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			// sync.Once のクロージャは t を受け取れないため、nil を格納して呼び出し元で検出する。
			return
		}
		sharedKeyPair = &TestKeyPair{
			PrivateKey: priv,
			PublicKey:  &priv.PublicKey,
		}
	})

	if sharedKeyPair == nil {
		t.Fatal("testutil: failed to generate RSA test key pair")
	}
	return sharedKeyPair
}

// GenerateTestToken は指定したユーザー/テナント/ロールの RS256 署名済み JWT アクセストークンを生成する。
// トークンは共有テスト鍵ペアで署名され、1 時間後に期限切れとなる。
func GenerateTestToken(t *testing.T, userID, tenantID, role string) string {
	t.Helper()

	kp := GenerateTestKeyPair(t)

	now := time.Now()
	claims := appjwt.Claims{
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(time.Hour)),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(kp.PrivateKey)
	if err != nil {
		t.Fatalf("testutil: failed to sign test JWT: %v", err)
	}
	return signed
}

// GenerateTestRefreshToken は指定した jti・userID・expiry で RS256 署名済み JWT リフレッシュトークンを生成する。
// テスト鍵ペアで署名し、token_type="refresh" を設定する。
// expiry に過去時刻を渡すと期限切れトークンを生成できる。
func GenerateTestRefreshToken(t *testing.T, jti, userID string, expiry time.Time) string {
	t.Helper()

	kp := GenerateTestKeyPair(t)

	now := time.Now()
	claims := appjwt.Claims{
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			ID:        jti,
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(expiry),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(kp.PrivateKey)
	if err != nil {
		t.Fatalf("testutil: failed to sign refresh JWT: %v", err)
	}
	return signed
}

// TestVerifier は共有テスト公開鍵をバックエンドとする jwt.Verifier を生成して返す。
func TestVerifier(t *testing.T) *appjwt.Verifier {
	t.Helper()
	kp := GenerateTestKeyPair(t)
	return appjwt.NewVerifierFromKey(kp.PublicKey)
}

// GenerateExpiredTestToken は有効期限切れの RS256 署名済みアクセストークンを生成する。
// DSH-002 等の期限切れトークンテスト用。
func GenerateExpiredTestToken(t *testing.T, userID, tenantID, role string) string {
	t.Helper()

	kp := GenerateTestKeyPair(t)

	// 有効期限を過去に設定して期限切れトークンを生成する。
	past := time.Now().Add(-2 * time.Hour)
	claims := appjwt.Claims{
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			IssuedAt:  gojwt.NewNumericDate(past.Add(-time.Hour)),
			ExpiresAt: gojwt.NewNumericDate(past),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(kp.PrivateKey)
	if err != nil {
		t.Fatalf("testutil: failed to sign expired test JWT: %v", err)
	}
	return signed
}
