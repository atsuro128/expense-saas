package jwt

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents the JWT payload for access tokens.
type Claims struct {
	UserID    string `json:"sub"`
	TenantID  string `json:"tenant_id"`
	Role      string `json:"role"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

// Verifier holds the RSA public key used to verify JWT RS256 tokens.
type Verifier struct {
	publicKey *rsa.PublicKey
}

// NewVerifier reads an RSA public key from a PEM file and returns a Verifier.
func NewVerifier(publicKeyPath string) (*Verifier, error) {
	data, err := os.ReadFile(publicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("read public key file: %w", err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("failed to decode PEM block from public key file")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse public key: %w", err)
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("public key is not an RSA key")
	}

	return &Verifier{publicKey: rsaPub}, nil
}

// Verify parses and validates a JWT token string.
// It enforces RS256 algorithm, expiry, issuer ("expense-saas"), and token_type ("access").
func (v *Verifier) Verify(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		if t.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, fmt.Errorf("unexpected algorithm: %v", t.Method.Alg())
		}
		return v.publicKey, nil
	}, jwt.WithIssuedAt(), jwt.WithIssuer("expense-saas"), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("token is invalid")
	}

	if claims.TokenType != "access" {
		return nil, fmt.Errorf("invalid token_type: %q", claims.TokenType)
	}

	if _, err = uuid.Parse(claims.UserID); err != nil {
		return nil, fmt.Errorf("invalid sub (user_id) format: %w", err)
	}
	if _, err = uuid.Parse(claims.TenantID); err != nil {
		return nil, fmt.Errorf("invalid tenant_id format: %w", err)
	}

	return claims, nil
}
