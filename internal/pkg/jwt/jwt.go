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

// Claims はアクセストークンの JWT ペイロードを表す。
type Claims struct {
	UserID    string `json:"sub"`
	TenantID  string `json:"tenant_id"`
	Role      string `json:"role"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

// Verifier は JWT RS256 トークンの検証に使用する RSA 公開鍵を保持する。
type Verifier struct {
	publicKey *rsa.PublicKey
}

// NewVerifier は PEM ファイルから RSA 公開鍵を読み込み、Verifier を返す。
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

// NewVerifierFromKey は RSA 公開鍵から直接 Verifier を生成する。
// ファイルからの読み込みが難しいテスト用途を想定している。
func NewVerifierFromKey(publicKey *rsa.PublicKey) *Verifier {
	return &Verifier{publicKey: publicKey}
}

// Verify は JWT トークン文字列を解析・検証する。
// RS256 アルゴリズム、有効期限、発行者（"expense-saas"）、token_type（"access"）を強制検証する。
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
