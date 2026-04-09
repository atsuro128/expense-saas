package domain

import (
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/alexedwards/argon2id"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// PasswordHasher はパスワードをハッシュ化・検証するインターフェース。
// 実装は Argon2id を使用する（security.md §2.2）。
type PasswordHasher interface {
	// HashPassword はパスワードを Argon2id でハッシュ化して返す。
	// 空文字列の場合はエラーを返す。
	HashPassword(password string) (string, error)
	// VerifyPassword はパスワードとハッシュが一致するか検証する。
	// 一致する場合は true を返す。不正なハッシュ形式の場合はエラーを返す。
	VerifyPassword(password, hash string) (bool, error)
}

// TokenClaims はアクセストークンに含まれる検証済みクレームを保持する。
type TokenClaims struct {
	// UserID は JWT の sub クレームから取得するユーザー ID。
	UserID uuid.UUID
	// TenantID は JWT の tenant_id クレームから取得するテナント ID。
	TenantID uuid.UUID
	// Role はテナント内のユーザーロール。
	Role Role
	// TokenType はトークン種別（"access" または "refresh"）。
	TokenType string
	// JTI はトークンの一意識別子（UUID 形式）。
	JTI uuid.UUID
}

// RefreshTokenClaims はリフレッシュトークンに含まれる検証済みクレームを保持する。
type RefreshTokenClaims struct {
	// UserID は JWT の sub クレームから取得するユーザー ID。
	UserID uuid.UUID
	// JTI はトークンの一意識別子（UUID 形式）。
	JTI uuid.UUID
}

// TokenGenerator は JWT アクセストークンとリフレッシュトークンを生成するインターフェース。
// 実装は RS256 署名を使用する（security.md §2.1）。
type TokenGenerator interface {
	// GenerateAccessToken はユーザー ID・テナント ID・ロールを含むアクセストークンを生成する。
	// 有効期限は 15 分（security.md §2.1）。
	GenerateAccessToken(userID uuid.UUID, tenantID uuid.UUID, role Role) (string, error)
	// GenerateRefreshToken はユーザー ID を含むリフレッシュトークンを生成する。
	// 有効期限は 7 日（security.md §2.1）。
	// tenant_id と role は含まない（RefreshToken クレームは最小限）。
	GenerateRefreshToken(userID uuid.UUID) (string, error)
}

// TokenVerifier は JWT トークンを検証するインターフェース。
// 実装は RS256 署名検証・発行者検証・有効期限検証を行う（security.md §2.1）。
type TokenVerifier interface {
	// VerifyAccessToken はアクセストークンを検証してクレームを返す。
	// 期限切れの場合は ErrTokenExpired、署名・発行者不正の場合は ErrInvalidToken を返す。
	VerifyAccessToken(tokenString string) (*TokenClaims, error)
	// VerifyRefreshToken はリフレッシュトークンを検証してクレームを返す。
	// 期限切れの場合は ErrTokenExpired、署名・種別不正の場合は ErrInvalidToken を返す。
	VerifyRefreshToken(tokenString string) (*RefreshTokenClaims, error)
}

// jwtClaims は JWT ペイロードの内部表現。生成・検証で共通使用する。
type jwtClaims struct {
	TenantID  string `json:"tenant_id,omitempty"`
	Role      string `json:"role,omitempty"`
	TokenType string `json:"token_type"`
	gojwt.RegisteredClaims
}

// JWTGenerator は RSA 秘密鍵を使用して JWT を生成する実装。
type JWTGenerator struct {
	privateKey *rsa.PrivateKey
	// kid は JWT ヘッダーの key ID。
	kid string
}

// NewJWTGenerator は指定した RSA 秘密鍵から JWTGenerator を生成する。
func NewJWTGenerator(privateKey *rsa.PrivateKey) *JWTGenerator {
	return &JWTGenerator{
		privateKey: privateKey,
		kid:        "expense-saas-key-1",
	}
}

// GenerateAccessToken はアクセストークンを RS256 で生成する。
// クレーム: iss, sub, exp(15分), jti, tenant_id, role, token_type=access。
func (g *JWTGenerator) GenerateAccessToken(userID uuid.UUID, tenantID uuid.UUID, role Role) (string, error) {
	now := time.Now()
	jti := uuid.New()

	claims := jwtClaims{
		TenantID:  tenantID.String(),
		Role:      string(role),
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   userID.String(),
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(15 * time.Minute)),
			ID:        jti.String(),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	// kid ヘッダーを付与する（security.md §2.1）。
	token.Header["kid"] = g.kid

	signed, err := token.SignedString(g.privateKey)
	if err != nil {
		return "", fmt.Errorf("JWTGenerator.GenerateAccessToken: %w", err)
	}
	return signed, nil
}

// GenerateRefreshToken はリフレッシュトークンを RS256 で生成する。
// クレーム: iss, sub, exp(7日), jti, token_type=refresh。tenant_id と role は含まない。
func (g *JWTGenerator) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	now := time.Now()
	jti := uuid.New()

	claims := jwtClaims{
		TokenType: "refresh",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   userID.String(),
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			ID:        jti.String(),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	token.Header["kid"] = g.kid

	signed, err := token.SignedString(g.privateKey)
	if err != nil {
		return "", fmt.Errorf("JWTGenerator.GenerateRefreshToken: %w", err)
	}
	return signed, nil
}

// JWTVerifier は RSA 公開鍵を保持し、JWT トークンを検証する実装。
type JWTVerifier struct {
	publicKey *rsa.PublicKey
}

// NewJWTVerifier は指定した RSA 公開鍵から JWTVerifier を生成する。
func NewJWTVerifier(publicKey *rsa.PublicKey) *JWTVerifier {
	return &JWTVerifier{publicKey: publicKey}
}

// parseToken は JWT 文字列を解析する内部ヘルパー。RS256 以外のアルゴリズムは拒否する。
func (v *JWTVerifier) parseToken(tokenString string) (*gojwt.Token, *jwtClaims, error) {
	claims := &jwtClaims{}
	token, err := gojwt.ParseWithClaims(
		tokenString,
		claims,
		func(t *gojwt.Token) (interface{}, error) {
			// RS256 以外のアルゴリズムは拒否する（security.md §2.1）。
			if _, ok := t.Method.(*gojwt.SigningMethodRSA); !ok {
				return nil, ErrInvalidToken
			}
			if t.Method.Alg() != gojwt.SigningMethodRS256.Alg() {
				return nil, ErrInvalidToken
			}
			return v.publicKey, nil
		},
		gojwt.WithIssuedAt(),
		gojwt.WithIssuer("expense-saas"),
		gojwt.WithExpirationRequired(),
	)
	return token, claims, err
}

// VerifyAccessToken はアクセストークンを検証してクレームを返す。
// 期限切れ → ErrTokenExpired、それ以外の不正 → ErrInvalidToken。
func (v *JWTVerifier) VerifyAccessToken(tokenString string) (*TokenClaims, error) {
	token, claims, err := v.parseToken(tokenString)
	if err != nil {
		if errors.Is(err, gojwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}

	// token_type が "access" でなければ拒否する。
	if claims.TokenType != "access" {
		return nil, ErrInvalidToken
	}

	// sub (userID) を UUID として解析する。
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// tenant_id を UUID として解析する。
	tenantID, err := uuid.Parse(claims.TenantID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// jti を UUID として解析する。
	jti, err := uuid.Parse(claims.ID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	role := Role(claims.Role)
	if !role.IsValid() {
		return nil, ErrInvalidToken
	}

	return &TokenClaims{
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		TokenType: claims.TokenType,
		JTI:       jti,
	}, nil
}

// VerifyRefreshToken はリフレッシュトークンを検証してクレームを返す。
// 期限切れ → ErrTokenExpired、それ以外の不正 → ErrInvalidToken。
func (v *JWTVerifier) VerifyRefreshToken(tokenString string) (*RefreshTokenClaims, error) {
	token, claims, err := v.parseToken(tokenString)
	if err != nil {
		if errors.Is(err, gojwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}

	// token_type が "refresh" でなければ拒否する。
	if claims.TokenType != "refresh" {
		return nil, ErrInvalidToken
	}

	// sub (userID) を UUID として解析する。
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// jti を UUID として解析する。
	jti, err := uuid.Parse(claims.ID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return &RefreshTokenClaims{
		UserID: userID,
		JTI:    jti,
	}, nil
}

// argon2idParams は Argon2id ハッシュのパラメータ（security.md §2.2）。
var argon2idParams = &argon2id.Params{
	Memory:      65536, // 64MB
	Iterations:  3,
	Parallelism: 4,
	SaltLength:  16,
	KeyLength:   32,
}

// Argon2idHasher は Argon2id アルゴリズムを使用したパスワードハッシュ実装。
type Argon2idHasher struct{}

// NewArgon2idHasher は Argon2idHasher を生成する。
func NewArgon2idHasher() *Argon2idHasher {
	return &Argon2idHasher{}
}

// HashPassword はパスワードを Argon2id でハッシュ化して返す。
// 空文字列が渡された場合はエラーを返す。
func (h *Argon2idHasher) HashPassword(password string) (string, error) {
	if password == "" {
		return "", errors.New("password must not be empty")
	}
	hash, err := argon2id.CreateHash(password, argon2idParams)
	if err != nil {
		return "", fmt.Errorf("Argon2idHasher.HashPassword: %w", err)
	}
	return hash, nil
}

// VerifyPassword はパスワードとハッシュを照合する。
// 一致する場合は true を返す。不正なハッシュ形式の場合はエラーを返す。
func (h *Argon2idHasher) VerifyPassword(password, hash string) (bool, error) {
	match, err := argon2id.ComparePasswordAndHash(password, hash)
	if err != nil {
		return false, fmt.Errorf("Argon2idHasher.VerifyPassword: %w", err)
	}
	return match, nil
}

// ErrInvalidToken は JWT 署名・形式・発行者・アルゴリズムが不正な場合に返す。
// HTTP: 401 INVALID_TOKEN
var ErrInvalidToken = errors.New("invalid token")
