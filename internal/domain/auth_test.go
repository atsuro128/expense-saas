package domain_test

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"strings"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// --- ヘルパー ---

// newHasher は Argon2idHasher のインスタンスを生成するテスト用ヘルパー。
func newHasher() *domain.Argon2idHasher {
	return domain.NewArgon2idHasher()
}

// generateRSAKey はテスト用 RSA 2048 ビット鍵ペアを生成する。
func generateRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("RSA 鍵生成に失敗しました: %v", err)
	}
	return priv
}

// newGenerator はテスト用鍵ペアで JWTGenerator を生成する。
func newGenerator(t *testing.T) (*domain.JWTGenerator, *rsa.PrivateKey) {
	t.Helper()
	priv := generateRSAKey(t)
	return domain.NewJWTGenerator(priv), priv
}

// =============================================================================
// 1.1 Argon2id ハッシュ・検証テスト
// =============================================================================

// AUTH-001: パスワードのハッシュ化が成功し、$argon2id$ で始まること。
func TestHashPassword_Success(t *testing.T) {
	// AUTH-001
	h := newHasher()
	hash, err := h.HashPassword("TestPass1!")
	if err != nil {
		t.Fatalf("HashPassword が予期しないエラーを返しました: %v", err)
	}
	if hash == "" {
		t.Fatal("HashPassword が空のハッシュを返しました")
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Errorf("ハッシュが $argon2id$ で始まりません: %q", hash)
	}
}

// AUTH-002: 空文字列パスワードではエラーが返ること。
func TestHashPassword_EmptyPassword(t *testing.T) {
	// AUTH-002
	h := newHasher()
	_, err := h.HashPassword("")
	if err == nil {
		t.Fatal("空パスワードで HashPassword がエラーを返しませんでした")
	}
}

// AUTH-003: 正しいパスワードの検証が true を返すこと。
func TestVerifyPassword_Correct(t *testing.T) {
	// AUTH-003
	h := newHasher()
	password := "TestPass1!"
	hash, err := h.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword が失敗しました: %v", err)
	}

	ok, err := h.VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword が予期しないエラーを返しました: %v", err)
	}
	if !ok {
		t.Error("正しいパスワードで VerifyPassword が false を返しました")
	}
}

// AUTH-004: 誤ったパスワードの検証が false を返すこと。
func TestVerifyPassword_Wrong(t *testing.T) {
	// AUTH-004
	h := newHasher()
	hash, err := h.HashPassword("TestPass1!")
	if err != nil {
		t.Fatalf("HashPassword が失敗しました: %v", err)
	}

	ok, err := h.VerifyPassword("WrongPass!", hash)
	if err != nil {
		t.Fatalf("VerifyPassword が予期しないエラーを返しました: %v", err)
	}
	if ok {
		t.Error("誤ったパスワードで VerifyPassword が true を返しました")
	}
}

// AUTH-005: 不正なハッシュ形式でエラーが返ること。
func TestVerifyPassword_InvalidHash(t *testing.T) {
	// AUTH-005
	h := newHasher()
	_, err := h.VerifyPassword("TestPass1!", "not-a-hash")
	if err == nil {
		t.Fatal("不正なハッシュ形式で VerifyPassword がエラーを返しませんでした")
	}
}

// AUTH-006: 同一パスワードを 2 回ハッシュしても異なるハッシュが生成されること（ランダムソルト）。
func TestHashPassword_UniquePerCall(t *testing.T) {
	// AUTH-006
	h := newHasher()
	password := "TestPass1!"
	hash1, err := h.HashPassword(password)
	if err != nil {
		t.Fatalf("1 回目の HashPassword が失敗しました: %v", err)
	}
	hash2, err := h.HashPassword(password)
	if err != nil {
		t.Fatalf("2 回目の HashPassword が失敗しました: %v", err)
	}
	if hash1 == hash2 {
		t.Error("同一パスワードのハッシュが同一です（ソルトが固定されている可能性があります）")
	}
}

// AUTH-007: ハッシュのパラメータが m=65536,t=3,p=4 であること。
func TestHashPassword_Argon2idParams(t *testing.T) {
	// AUTH-007
	h := newHasher()
	hash, err := h.HashPassword("TestPass1!")
	if err != nil {
		t.Fatalf("HashPassword が失敗しました: %v", err)
	}
	// Argon2id ハッシュ形式: $argon2id$v=19$m=65536,t=3,p=4$...
	const expectedParams = "m=65536,t=3,p=4"
	if !strings.Contains(hash, expectedParams) {
		t.Errorf("ハッシュパラメータが期待と異なります。期待: %q を含む, 実際: %q", expectedParams, hash)
	}
}

// =============================================================================
// 1.2 JWT 生成・検証テスト
// =============================================================================

// テスト用の定数（test_strategy.md §4 のフィクスチャ値）。
const (
	testUserIDStr   = "aaaaaaaa-1111-1111-1111-000000000001"
	testTenantIDStr = "aaaaaaaa-0001-0001-0001-000000000001"
	testRole        = domain.RoleAdmin
)

var (
	testUserID   = uuid.MustParse(testUserIDStr)
	testTenantID = uuid.MustParse(testTenantIDStr)
)

// AUTH-008: アクセストークンが生成され、3 パート構成の文字列であること。
func TestGenerateAccessToken_Success(t *testing.T) {
	// AUTH-008
	gen, _ := newGenerator(t)
	token, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が予期しないエラーを返しました: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Errorf("アクセストークンが 3 パート構成ではありません: %d パート", len(parts))
	}
}

// AUTH-009: アクセストークンの claims に必要なフィールドが含まれること。
func TestGenerateAccessToken_Claims(t *testing.T) {
	// AUTH-009
	gen, priv := newGenerator(t)
	token, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が失敗しました: %v", err)
	}

	// 生成したトークンを解析してクレームを検証する。
	type testClaims struct {
		Sub       string `json:"sub"`
		TenantID  string `json:"tenant_id"`
		Role      string `json:"role"`
		TokenType string `json:"token_type"`
		Issuer    string `json:"iss"`
		JTI       string `json:"jti"`
		gojwt.RegisteredClaims
	}

	parsed, err := gojwt.ParseWithClaims(token, &testClaims{}, func(t *gojwt.Token) (interface{}, error) {
		return &priv.PublicKey, nil
	})
	if err != nil {
		t.Fatalf("トークン解析に失敗しました: %v", err)
	}

	claims, ok := parsed.Claims.(*testClaims)
	if !ok {
		t.Fatal("クレームの型変換に失敗しました")
	}

	if claims.Sub != testUserIDStr {
		t.Errorf("sub が期待値と異なります: got %q, want %q", claims.Sub, testUserIDStr)
	}
	if claims.TenantID != testTenantIDStr {
		t.Errorf("tenant_id が期待値と異なります: got %q, want %q", claims.TenantID, testTenantIDStr)
	}
	if claims.Role != string(testRole) {
		t.Errorf("role が期待値と異なります: got %q, want %q", claims.Role, testRole)
	}
	if claims.TokenType != "access" {
		t.Errorf("token_type が期待値と異なります: got %q, want %q", claims.TokenType, "access")
	}
	if claims.Issuer != "expense-saas" {
		t.Errorf("iss が期待値と異なります: got %q, want %q", claims.Issuer, "expense-saas")
	}
	if claims.JTI == "" {
		t.Error("jti が空です")
	}
	if _, err := uuid.Parse(claims.JTI); err != nil {
		t.Errorf("jti が有効な UUID ではありません: %q", claims.JTI)
	}
}

// AUTH-010: アクセストークンの有効期限が現在時刻 + 15 分であること（±5 秒の誤差を許容）。
func TestGenerateAccessToken_Expiry(t *testing.T) {
	// AUTH-010
	gen, priv := newGenerator(t)
	before := time.Now()
	token, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が失敗しました: %v", err)
	}
	after := time.Now()

	parsed, err := gojwt.ParseWithClaims(token, &gojwt.RegisteredClaims{}, func(t *gojwt.Token) (interface{}, error) {
		return &priv.PublicKey, nil
	})
	if err != nil {
		t.Fatalf("トークン解析に失敗しました: %v", err)
	}

	claims := parsed.Claims.(*gojwt.RegisteredClaims)
	exp := claims.ExpiresAt.Time

	expectedMin := before.Add(15 * time.Minute).Add(-5 * time.Second)
	expectedMax := after.Add(15 * time.Minute).Add(5 * time.Second)

	if exp.Before(expectedMin) || exp.After(expectedMax) {
		t.Errorf("exp が期待範囲外です: got %v, want [%v, %v]", exp, expectedMin, expectedMax)
	}
}

// AUTH-011: リフレッシュトークンが生成され、3 パート構成の文字列であること。
func TestGenerateRefreshToken_Success(t *testing.T) {
	// AUTH-011
	gen, _ := newGenerator(t)
	token, err := gen.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken が予期しないエラーを返しました: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Errorf("リフレッシュトークンが 3 パート構成ではありません: %d パート", len(parts))
	}
}

// AUTH-012: リフレッシュトークンの claims に token_type=refresh が含まれ、tenant_id と role が含まれないこと。
func TestGenerateRefreshToken_Claims(t *testing.T) {
	// AUTH-012
	gen, priv := newGenerator(t)
	token, err := gen.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken が失敗しました: %v", err)
	}

	type testClaims struct {
		TokenType string `json:"token_type"`
		TenantID  string `json:"tenant_id"`
		Role      string `json:"role"`
		gojwt.RegisteredClaims
	}

	parsed, err := gojwt.ParseWithClaims(token, &testClaims{}, func(t *gojwt.Token) (interface{}, error) {
		return &priv.PublicKey, nil
	})
	if err != nil {
		t.Fatalf("トークン解析に失敗しました: %v", err)
	}

	claims, ok := parsed.Claims.(*testClaims)
	if !ok {
		t.Fatal("クレームの型変換に失敗しました")
	}

	if claims.TokenType != "refresh" {
		t.Errorf("token_type が期待値と異なります: got %q, want %q", claims.TokenType, "refresh")
	}
	if claims.TenantID != "" {
		t.Errorf("リフレッシュトークンに tenant_id が含まれています: %q", claims.TenantID)
	}
	if claims.Role != "" {
		t.Errorf("リフレッシュトークンに role が含まれています: %q", claims.Role)
	}
}

// AUTH-013: リフレッシュトークンの有効期限が現在時刻 + 7 日であること（±5 秒の誤差を許容）。
func TestGenerateRefreshToken_Expiry(t *testing.T) {
	// AUTH-013
	gen, priv := newGenerator(t)
	before := time.Now()
	token, err := gen.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken が失敗しました: %v", err)
	}
	after := time.Now()

	parsed, err := gojwt.ParseWithClaims(token, &gojwt.RegisteredClaims{}, func(t *gojwt.Token) (interface{}, error) {
		return &priv.PublicKey, nil
	})
	if err != nil {
		t.Fatalf("トークン解析に失敗しました: %v", err)
	}

	claims := parsed.Claims.(*gojwt.RegisteredClaims)
	exp := claims.ExpiresAt.Time

	expectedMin := before.Add(7 * 24 * time.Hour).Add(-5 * time.Second)
	expectedMax := after.Add(7 * 24 * time.Hour).Add(5 * time.Second)

	if exp.Before(expectedMin) || exp.After(expectedMax) {
		t.Errorf("exp が期待範囲外です: got %v, want [%v, %v]", exp, expectedMin, expectedMax)
	}
}

// --- VerifyAccessToken テスト用ヘルパー ---

// newVerifier は JWTGenerator に対応する JWTVerifier を生成するテスト用ヘルパー。
func newVerifier(priv *rsa.PrivateKey) *domain.JWTVerifier {
	return domain.NewJWTVerifier(&priv.PublicKey)
}

// AUTH-014: 有効なアクセストークンの検証が成功すること。
func TestVerifyAccessToken_Valid(t *testing.T) {
	// AUTH-014
	gen, priv := newGenerator(t)
	v := newVerifier(priv)

	token, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が失敗しました: %v", err)
	}

	claims, err := v.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("VerifyAccessToken が失敗しました: %v", err)
	}
	if claims.UserID != testUserID {
		t.Errorf("UserID が期待値と異なります: got %v, want %v", claims.UserID, testUserID)
	}
	if claims.TenantID != testTenantID {
		t.Errorf("TenantID が期待値と異なります: got %v, want %v", claims.TenantID, testTenantID)
	}
	if claims.Role != testRole {
		t.Errorf("Role が期待値と異なります: got %v, want %v", claims.Role, testRole)
	}
}

// AUTH-015: 有効期限切れのアクセストークンで ErrTokenExpired が返ること。
func TestVerifyAccessToken_Expired(t *testing.T) {
	// AUTH-015
	priv := generateRSAKey(t)
	v := newVerifier(priv)

	// 期限切れトークンを直接生成する（exp を過去に設定）。
	type expiredClaims struct {
		TenantID  string `json:"tenant_id"`
		Role      string `json:"role"`
		TokenType string `json:"token_type"`
		gojwt.RegisteredClaims
	}
	past := time.Now().Add(-2 * time.Hour)
	claims := expiredClaims{
		TenantID:  testTenantID.String(),
		Role:      string(testRole),
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   testUserID.String(),
			IssuedAt:  gojwt.NewNumericDate(past.Add(-time.Hour)),
			ExpiresAt: gojwt.NewNumericDate(past),
			ID:        uuid.New().String(),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := tok.SignedString(priv)
	if err != nil {
		t.Fatalf("トークン署名に失敗しました: %v", err)
	}

	_, err = v.VerifyAccessToken(signed)
	if !errors.Is(err, domain.ErrTokenExpired) {
		t.Errorf("ErrTokenExpired を期待しましたが got: %v", err)
	}
}

// AUTH-016: 別の秘密鍵で署名されたトークンで ErrInvalidToken が返ること。
func TestVerifyAccessToken_InvalidSignature(t *testing.T) {
	// AUTH-016
	gen, _ := newGenerator(t)
	// 別のキーで検証器を作成する（署名鍵と異なる）。
	otherPriv := generateRSAKey(t)
	v := newVerifier(otherPriv)

	token, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が失敗しました: %v", err)
	}

	_, err = v.VerifyAccessToken(token)
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}

// AUTH-017: HS256 で署名されたトークン（alg 混乱攻撃）で ErrInvalidToken が返ること。
func TestVerifyAccessToken_WrongAlgorithm(t *testing.T) {
	// AUTH-017
	priv := generateRSAKey(t)
	v := newVerifier(priv)

	// HS256 で署名したトークンを作成する（alg 混乱攻撃）。
	type algClaims struct {
		TokenType string `json:"token_type"`
		gojwt.RegisteredClaims
	}
	claims := algClaims{
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   testUserID.String(),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			ID:        uuid.New().String(),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte("secret"))
	if err != nil {
		t.Fatalf("トークン署名に失敗しました: %v", err)
	}

	_, err = v.VerifyAccessToken(signed)
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}

// AUTH-018: 不正な発行者のトークンで ErrInvalidToken が返ること。
func TestVerifyAccessToken_WrongIssuer(t *testing.T) {
	// AUTH-018
	priv := generateRSAKey(t)
	v := newVerifier(priv)

	type issuerClaims struct {
		TenantID  string `json:"tenant_id"`
		Role      string `json:"role"`
		TokenType string `json:"token_type"`
		gojwt.RegisteredClaims
	}
	claims := issuerClaims{
		TenantID:  testTenantID.String(),
		Role:      string(testRole),
		TokenType: "access",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "wrong-issuer",
			Subject:   testUserID.String(),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			ID:        uuid.New().String(),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := tok.SignedString(priv)
	if err != nil {
		t.Fatalf("トークン署名に失敗しました: %v", err)
	}

	_, err = v.VerifyAccessToken(signed)
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}

// AUTH-019: リフレッシュトークンをアクセストークン検証に使用すると ErrInvalidToken が返ること。
func TestVerifyAccessToken_WrongTokenType(t *testing.T) {
	// AUTH-019
	gen, priv := newGenerator(t)
	v := newVerifier(priv)

	// リフレッシュトークンを生成する。
	refreshToken, err := gen.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken が失敗しました: %v", err)
	}

	// リフレッシュトークンをアクセストークン検証に使用する。
	_, err = v.VerifyAccessToken(refreshToken)
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}

// AUTH-020: 不正形式の文字列で ErrInvalidToken が返ること。
func TestVerifyAccessToken_MalformedString(t *testing.T) {
	// AUTH-020
	priv := generateRSAKey(t)
	v := newVerifier(priv)

	_, err := v.VerifyAccessToken("not.a.jwt")
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}

// AUTH-021: 有効なリフレッシュトークンの検証が成功し、UserID と JTI が返ること。
func TestVerifyRefreshToken_Valid(t *testing.T) {
	// AUTH-021
	gen, priv := newGenerator(t)
	v := newVerifier(priv)

	token, err := gen.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken が失敗しました: %v", err)
	}

	claims, err := v.VerifyRefreshToken(token)
	if err != nil {
		t.Fatalf("VerifyRefreshToken が失敗しました: %v", err)
	}
	if claims.UserID != testUserID {
		t.Errorf("UserID が期待値と異なります: got %v, want %v", claims.UserID, testUserID)
	}
	if claims.JTI == uuid.Nil {
		t.Error("JTI が空（uuid.Nil）です")
	}
}

// AUTH-022: 有効期限切れのリフレッシュトークンで ErrTokenExpired が返ること。
func TestVerifyRefreshToken_Expired(t *testing.T) {
	// AUTH-022
	priv := generateRSAKey(t)
	v := newVerifier(priv)

	type expiredClaims struct {
		TokenType string `json:"token_type"`
		gojwt.RegisteredClaims
	}
	past := time.Now().Add(-2 * time.Hour)
	claims := expiredClaims{
		TokenType: "refresh",
		RegisteredClaims: gojwt.RegisteredClaims{
			Issuer:    "expense-saas",
			Subject:   testUserID.String(),
			IssuedAt:  gojwt.NewNumericDate(past.Add(-time.Hour)),
			ExpiresAt: gojwt.NewNumericDate(past),
			ID:        uuid.New().String(),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := tok.SignedString(priv)
	if err != nil {
		t.Fatalf("トークン署名に失敗しました: %v", err)
	}

	_, err = v.VerifyRefreshToken(signed)
	if !errors.Is(err, domain.ErrTokenExpired) {
		t.Errorf("ErrTokenExpired を期待しましたが got: %v", err)
	}
}

// AUTH-023: アクセストークンをリフレッシュトークン検証に使用すると ErrInvalidToken が返ること。
func TestVerifyRefreshToken_WrongTokenType(t *testing.T) {
	// AUTH-023
	gen, priv := newGenerator(t)
	v := newVerifier(priv)

	// アクセストークンを生成する。
	accessToken, err := gen.GenerateAccessToken(testUserID, testTenantID, testRole)
	if err != nil {
		t.Fatalf("GenerateAccessToken が失敗しました: %v", err)
	}

	// アクセストークンをリフレッシュトークン検証に使用する。
	_, err = v.VerifyRefreshToken(accessToken)
	if !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("ErrInvalidToken を期待しましたが got: %v", err)
	}
}
