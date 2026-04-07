package domain

import (
	"crypto/rsa"
	"errors"

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

// JWTGenerator は RSA 秘密鍵を使用して JWT を生成する実装（未実装スタブ）。
type JWTGenerator struct {
	privateKey *rsa.PrivateKey
}

// NewJWTGenerator は指定した RSA 秘密鍵から JWTGenerator を生成する。
func NewJWTGenerator(privateKey *rsa.PrivateKey) *JWTGenerator {
	return &JWTGenerator{privateKey: privateKey}
}

// GenerateAccessToken はアクセストークンを生成する（未実装）。
func (g *JWTGenerator) GenerateAccessToken(userID uuid.UUID, tenantID uuid.UUID, role Role) (string, error) {
	return "", errors.New("not implemented")
}

// GenerateRefreshToken はリフレッシュトークンを生成する（未実装）。
func (g *JWTGenerator) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	return "", errors.New("not implemented")
}

// Argon2idHasher は Argon2id アルゴリズムを使用したパスワードハッシュ実装（未実装スタブ）。
type Argon2idHasher struct{}

// NewArgon2idHasher は Argon2idHasher を生成する。
func NewArgon2idHasher() *Argon2idHasher {
	return &Argon2idHasher{}
}

// HashPassword はパスワードを Argon2id でハッシュ化する（未実装）。
func (h *Argon2idHasher) HashPassword(password string) (string, error) {
	return "", errors.New("not implemented")
}

// VerifyPassword はパスワードとハッシュを照合する（未実装）。
func (h *Argon2idHasher) VerifyPassword(password, hash string) (bool, error) {
	return false, errors.New("not implemented")
}

// ErrInvalidToken は JWT 署名・形式・発行者・アルゴリズムが不正な場合に返す。
// HTTP: 401 INVALID_TOKEN
var ErrInvalidToken = errors.New("invalid token")
