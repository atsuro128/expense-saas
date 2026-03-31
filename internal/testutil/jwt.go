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

// TestKeyPair holds an in-memory RSA key pair used exclusively for testing.
type TestKeyPair struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

var (
	sharedKeyPairOnce sync.Once
	sharedKeyPair     *TestKeyPair
)

// GenerateTestKeyPair returns a package-level singleton RSA 2048-bit key pair.
// The key pair is generated once per test binary run via sync.Once.
func GenerateTestKeyPair(t *testing.T) *TestKeyPair {
	t.Helper()

	sharedKeyPairOnce.Do(func() {
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			// sync.Once body does not receive t, so we store nil and let callers detect it.
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

// GenerateTestToken creates a signed RS256 JWT access token for the given user/tenant/role.
// The token is signed with the shared test key pair and expires in 1 hour.
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

// TestVerifier constructs a jwt.Verifier backed by the shared test public key.
func TestVerifier(t *testing.T) *appjwt.Verifier {
	t.Helper()
	kp := GenerateTestKeyPair(t)
	return appjwt.NewVerifierFromKey(kp.PublicKey)
}
