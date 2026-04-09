package handler_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// sha256Hex は文字列を SHA-256 でハッシュ化し、16進数文字列（64文字）を返す。
// security.md 2.3 および db_schema.md 4.8/4.9 の設計に基づき、
// DB には平文ではなく SHA-256 ハッシュを保存する。
func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupAuthTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupAuthTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// jsonBody は任意の値を JSON エンコードした bytes.Reader を返す。
func jsonBody(t *testing.T, v any) *bytes.Reader {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("JSON エンコードに失敗しました: %v", err)
	}
	return bytes.NewReader(b)
}

// authResponse は認証エンドポイントのレスポンスボディを表す。
type authResponse struct {
	Data struct {
		User struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Email string `json:"email"`
			Role  string `json:"role"`
		} `json:"user"`
		Tenant struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"tenant"`
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	} `json:"data"`
}

// loginAndGetTokens はフィクスチャユーザーでログインしてトークンを取得するヘルパー。
func loginAndGetTokens(t *testing.T, srv *testutil.TestServer, email, password string) (accessToken, refreshToken string) {
	t.Helper()

	body := jsonBody(t, map[string]string{
		"email":    email,
		"password": password,
	})
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)
	if rec.Code != http.StatusOK {
		t.Fatalf("ログインに失敗しました: status=%d, body=%s", rec.Code, rec.Body.String())
	}

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	return resp.Data.AccessToken, resp.Data.RefreshToken
}

// insertPasswordResetToken はテスト用にパスワードリセットトークンを直接 DB に挿入する。
// token_hash には tokenValue の SHA-256 ハッシュを保存する（security.md 2.3, db_schema.md 4.9）。
// テストでは平文の tokenValue を URL に渡し、サーバー側がハッシュ化して照合する想定。
func insertPasswordResetToken(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID, tokenValue string, expiresAt time.Time) {
	t.Helper()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	id := uuid.New()
	now := time.Now().UTC()
	// token_hash には平文ではなく SHA-256 ハッシュを保存する（db_schema.md 4.9）。
	if _, err := conn.Exec(ctx,
		`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		id, userID, sha256Hex(tokenValue), expiresAt, now,
	); err != nil {
		t.Fatalf("パスワードリセットトークンの挿入に失敗しました: %v", err)
	}
}

// insertRevokedRefreshToken はテスト用に無効化済みリフレッシュトークンを直接 DB に挿入する。
// jti には JWT の jti クレームに対応する UUID 文字列を渡す。
// tokenJWT には実際に HTTP リクエストで送信するリフレッシュトークン JWT を渡す。
// token_hash には tokenJWT の SHA-256 ハッシュを保存する（db_schema.md 4.8）。
func insertRevokedRefreshToken(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID, jti, tokenJWT string) {
	t.Helper()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	jtiUUID := uuid.MustParse(jti)
	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)
	// token_hash には JWT 文字列の SHA-256 ハッシュを保存する（db_schema.md 4.8）。
	if _, err := conn.Exec(ctx,
		`INSERT INTO refresh_tokens (jti, user_id, token_hash, is_revoked, expires_at, created_at)
		 VALUES ($1, $2, $3, true, $4, $5)`,
		jtiUUID, userID, sha256Hex(tokenJWT), expiresAt, now,
	); err != nil {
		t.Fatalf("無効化済みリフレッシュトークンの挿入に失敗しました: %v", err)
	}
}

// =============================================================================
// POST /api/auth/signup
// =============================================================================

// TestSignup_Success: 正常系 - サインアップ成功で 201 と AuthTokens が返ること。
func TestSignup_Success(t *testing.T) {
	// AUTH-024
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "New Corp",
		"user_name":    "Test Admin",
		"email":        "new@example.com",
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusCreated)

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}
	if resp.Data.AccessToken == "" {
		t.Error("access_token が空です")
	}
	if resp.Data.RefreshToken == "" {
		t.Error("refresh_token が空です")
	}
}

// TestSignup_DuplicateEmail: 異常系 - 既存メールアドレスで 409 EMAIL_ALREADY_EXISTS が返ること。
func TestSignup_DuplicateEmail(t *testing.T) {
	// AUTH-025
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "Another Corp",
		"user_name":    "Another User",
		"email":        "test-admin@example.com", // フィクスチャで既存
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusConflict)
	testutil.AssertErrorCode(t, rec, "EMAIL_ALREADY_EXISTS")
}

// TestSignup_ValidationError_MissingCompanyName: 異常系 - company_name を省略すると 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_MissingCompanyName(t *testing.T) {
	// AUTH-026
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"user_name": "Test User",
		"email":     "valid@example.com",
		"password":  "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")

	// details に company_name フィールドのエラーが含まれること。
	var errBody struct {
		Error struct {
			Code    string `json:"code"`
			Details []struct {
				Field string `json:"field"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err == nil {
		found := false
		for _, d := range errBody.Error.Details {
			if d.Field == "company_name" {
				found = true
				break
			}
		}
		if !found {
			t.Error("details に company_name フィールドのエラーが含まれていません")
		}
	}
}

// TestSignup_ValidationError_MissingEmail: 異常系 - email を省略すると 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_MissingEmail(t *testing.T) {
	// AUTH-027
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "New Corp",
		"user_name":    "Test User",
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")

	var errBody struct {
		Error struct {
			Details []struct {
				Field string `json:"field"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err == nil {
		found := false
		for _, d := range errBody.Error.Details {
			if d.Field == "email" {
				found = true
				break
			}
		}
		if !found {
			t.Error("details に email フィールドのエラーが含まれていません")
		}
	}
}

// TestSignup_ValidationError_InvalidEmail: 異常系 - 不正なメール形式で 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_InvalidEmail(t *testing.T) {
	// AUTH-028
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "New Corp",
		"user_name":    "Test User",
		"email":        "not-an-email",
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestSignup_ValidationError_PasswordTooShort: 境界値 - 7 文字のパスワードで 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_PasswordTooShort(t *testing.T) {
	// AUTH-029
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "New Corp",
		"user_name":    "Test User",
		"email":        "valid@example.com",
		"password":     "short", // 5文字（7文字未満）
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestSignup_ValidationError_PasswordTooLong: 境界値 - 129 文字のパスワードで 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_PasswordTooLong(t *testing.T) {
	// AUTH-030
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "New Corp",
		"user_name":    "Test User",
		"email":        "valid@example.com",
		"password":     strings.Repeat("a", 129),
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestSignup_ValidationError_CompanyNameTooLong: 境界値 - 201 文字の company_name で 422 VALIDATION_ERROR が返ること。
func TestSignup_ValidationError_CompanyNameTooLong(t *testing.T) {
	// AUTH-031
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": strings.Repeat("あ", 201),
		"user_name":    "Test User",
		"email":        "valid@example.com",
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestSignup_InvalidJsonBody: 異常系 - 不正な JSON ボディで 400 BAD_REQUEST が返ること。
func TestSignup_InvalidJsonBody(t *testing.T) {
	// AUTH-032
	srv, _ := setupAuthTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestSignup_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestSignup_NoAuthRequired(t *testing.T) {
	// AUTH-033
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"company_name": "No Auth Corp",
		"user_name":    "No Auth User",
		"email":        "noauth@example.com",
		"password":     "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	// 401 でないこと（認証不要エンドポイント）。
	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// POST /api/auth/login
// =============================================================================

// TestLogin_Success: 正常系 - ログイン成功で 200 と AuthTokens が返ること。
func TestLogin_Success(t *testing.T) {
	// AUTH-034
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email":    "test-admin@example.com",
		"password": "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}
	if resp.Data.AccessToken == "" {
		t.Error("access_token が空です")
	}
	if resp.Data.RefreshToken == "" {
		t.Error("refresh_token が空です")
	}
}

// TestLogin_WrongPassword: 異常系 - 誤ったパスワードで 401 INVALID_CREDENTIALS が返ること。
func TestLogin_WrongPassword(t *testing.T) {
	// AUTH-035
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email":    "test-admin@example.com",
		"password": "WrongPass!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_CREDENTIALS")
}

// TestLogin_NotExistEmail: セキュリティ - 存在しないメールでも 401 INVALID_CREDENTIALS が返ること（SEC-011）。
func TestLogin_NotExistEmail(t *testing.T) {
	// AUTH-036
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email":    "nobody@example.com",
		"password": "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_CREDENTIALS")
}

// TestLogin_InvalidEmailFormat: セキュリティ - メール形式不正でも 401 INVALID_CREDENTIALS が返ること（SEC-011）。
func TestLogin_InvalidEmailFormat(t *testing.T) {
	// AUTH-037
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email":    "not-an-email",
		"password": "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_CREDENTIALS")
}

// TestLogin_MissingEmail: 異常系 - email を省略すると 400 BAD_REQUEST が返ること。
func TestLogin_MissingEmail(t *testing.T) {
	// AUTH-038
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"password": "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestLogin_MissingPassword: 異常系 - password を省略すると 400 BAD_REQUEST が返ること。
func TestLogin_MissingPassword(t *testing.T) {
	// AUTH-039
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email": "test-admin@example.com",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestLogin_InvalidJsonBody: 異常系 - 不正な JSON ボディで 400 BAD_REQUEST が返ること。
func TestLogin_InvalidJsonBody(t *testing.T) {
	// AUTH-040
	srv, _ := setupAuthTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestLogin_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestLogin_NoAuthRequired(t *testing.T) {
	// AUTH-041
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"email":    "test-admin@example.com",
		"password": "TestPass1!",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// POST /api/auth/refresh
// =============================================================================

// TestRefreshToken_Success: 正常系 - 有効なリフレッシュトークンで新しいトークンペアが返ること。
func TestRefreshToken_Success(t *testing.T) {
	// AUTH-042
	srv, _ := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	body := jsonBody(t, map[string]string{
		"refresh_token": refreshToken,
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.AccessToken == "" {
		t.Error("新しい access_token が空です")
	}
	if resp.Data.RefreshToken == "" {
		t.Error("新しい refresh_token が空です")
	}
}

// TestRefreshToken_Rotation: セキュリティ - 旧リフレッシュトークンが無効化されること（トークンローテーション）。
func TestRefreshToken_Rotation(t *testing.T) {
	// AUTH-043
	srv, _ := setupAuthTest(t)

	_, refreshTokenA := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	// 1 回目のリフレッシュ（成功）。
	body := jsonBody(t, map[string]string{"refresh_token": refreshTokenA})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)
	testutil.AssertStatus(t, rec, http.StatusOK)

	// 2 回目は旧トークン A を再度使用（無効化済みのはず）。
	body2 := jsonBody(t, map[string]string{"refresh_token": refreshTokenA})
	req2, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := srv.Execute(req2)
	testutil.AssertStatus(t, rec2, http.StatusUnauthorized)
}

// TestRefreshToken_RevokedToken: 異常系 - 失効済みトークンで 401 が返ること。
func TestRefreshToken_RevokedToken(t *testing.T) {
	// AUTH-044
	srv, pool := setupAuthTest(t)

	// DB に挿入する is_revoked=true レコードの jti を固定し、対応する JWT を生成する。
	jti := "ffffffff-0001-0001-0001-000000000001"
	userID := uuid.MustParse(testutil.UserAdminID)

	// jti に対応するリフレッシュトークン JWT を生成する（有効期限は将来）。
	revokedJWT := testutil.GenerateTestRefreshToken(t, jti, testutil.UserAdminID, time.Now().Add(7*24*time.Hour))

	// 生成した JWT の SHA-256 ハッシュを token_hash として DB に挿入し、is_revoked=true にする。
	insertRevokedRefreshToken(t, pool, userID, jti, revokedJWT)

	// DB に挿入した revoked token に対応する JWT を /api/auth/refresh に送信する。
	body := jsonBody(t, map[string]string{"refresh_token": revokedJWT})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	// is_revoked=true のトークンは 401 INVALID_TOKEN が返ること。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestRefreshToken_ExpiredToken: 異常系 - 有効期限切れのリフレッシュトークンで 401 TOKEN_EXPIRED が返ること。
func TestRefreshToken_ExpiredToken(t *testing.T) {
	// AUTH-045
	srv, _ := setupAuthTest(t)

	// exp を過去日時に設定した JWT リフレッシュトークンを生成する。
	// testutil.GenerateTestRefreshToken に過去の expiry を渡すことで、
	// JWT ライブラリレベルで期限切れとなるトークンを生成する。
	jti := uuid.New().String()
	expiredJWT := testutil.GenerateTestRefreshToken(t, jti, testutil.UserAdminID, time.Now().Add(-24*time.Hour))

	body := jsonBody(t, map[string]string{
		"refresh_token": expiredJWT,
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	// 期限切れ JWT は TOKEN_EXPIRED エラーコードで 401 を返すこと。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "TOKEN_EXPIRED")
}

// TestRefreshToken_AccessTokenAsRefresh: 異常系 - アクセストークンをリフレッシュトークンとして使用すると 401 が返ること。
func TestRefreshToken_AccessTokenAsRefresh(t *testing.T) {
	// AUTH-046
	srv, _ := setupAuthTest(t)

	// テスト用アクセストークンを生成する。
	accessToken := testutil.GenerateTestToken(t, testutil.UserAdminID, testutil.TenantAID, string(domain.RoleAdmin))

	body := jsonBody(t, map[string]string{
		"refresh_token": accessToken,
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestRefreshToken_InvalidFormat: 異常系 - 不正形式のリフレッシュトークンで 401 INVALID_TOKEN が返ること。
func TestRefreshToken_InvalidFormat(t *testing.T) {
	// AUTH-047
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{
		"refresh_token": "not.a.valid.jwt",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestRefreshToken_MissingBody: 異常系 - refresh_token を省略すると 400 BAD_REQUEST が返ること。
func TestRefreshToken_MissingBody(t *testing.T) {
	// AUTH-048
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestRefreshToken_ReflectsRoleChange: 正常系 - ロール変更後の新しいアクセストークンに最新ロールが反映されること。
func TestRefreshToken_ReflectsRoleChange(t *testing.T) {
	// AUTH-049
	srv, pool := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	// DB で admin ユーザーのロールを member に変更する。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	if _, err := conn.Exec(ctx,
		`UPDATE tenant_memberships SET role = 'member' WHERE user_id = $1 AND tenant_id = $2`,
		uuid.MustParse(testutil.UserAdminID), uuid.MustParse(testutil.TenantAID),
	); err != nil {
		conn.Release()
		t.Fatalf("ロール変更に失敗しました: %v", err)
	}
	conn.Release()

	// リフレッシュして新しいアクセストークンを取得する。
	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	// 新しいアクセストークンのロールが member であることを確認する。
	if resp.Data.User.Role != "member" {
		t.Errorf("新しいアクセストークンのロールが期待値と異なります: got %q, want %q", resp.Data.User.Role, "member")
	}
}

// TestRefreshToken_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestRefreshToken_NoAuthRequired(t *testing.T) {
	// AUTH-050
	srv, _ := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// POST /api/auth/logout
// =============================================================================

// TestLogout_Success: 正常系 - ログアウト成功で 200 と message が返り、DB が is_revoked=true になること。
func TestLogout_Success(t *testing.T) {
	// AUTH-051
	srv, pool := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Message == "" {
		t.Error("data.message が空です")
	}

	// DB でリフレッシュトークンが is_revoked=true になっていることを確認する。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	var revokedCount int
	if err := conn.QueryRow(ctx,
		`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = true`,
		uuid.MustParse(testutil.UserAdminID),
	).Scan(&revokedCount); err != nil {
		t.Fatalf("DB クエリに失敗しました: %v", err)
	}
	if revokedCount == 0 {
		t.Error("DB に is_revoked=true のリフレッシュトークンが存在しません")
	}
}

// TestLogout_WithExpiredAccessToken: 正常系 - 期限切れアクセストークンでもログアウトできること。
func TestLogout_WithExpiredAccessToken(t *testing.T) {
	// AUTH-052
	srv, _ := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")
	// 期限切れアクセストークンを Authorization ヘッダーに設定（ログアウトは依存しない）。
	req.Header.Set("Authorization", "Bearer expired.access.token")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestLogout_AlreadyRevokedToken: 異常系 - 失効済みトークンで 401 が返ること。
func TestLogout_AlreadyRevokedToken(t *testing.T) {
	// AUTH-053
	srv, _ := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	// 1 回目のログアウト（成功）。
	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")
	srv.Execute(req)

	// 2 回目のログアウト（失効済みトークン）。
	body2 := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req2, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := srv.Execute(req2)

	testutil.AssertStatus(t, rec2, http.StatusUnauthorized)
}

// TestLogout_InvalidRefreshToken: 異常系 - 不正なリフレッシュトークンで 401 INVALID_TOKEN が返ること。
func TestLogout_InvalidRefreshToken(t *testing.T) {
	// AUTH-054
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{"refresh_token": "invalid.token.value"})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestLogout_MissingRefreshToken: 異常系 - refresh_token を省略すると 400 BAD_REQUEST が返ること。
func TestLogout_MissingRefreshToken(t *testing.T) {
	// AUTH-055
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "BAD_REQUEST")
}

// TestLogout_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestLogout_NoAuthRequired(t *testing.T) {
	// AUTH-056
	srv, _ := setupAuthTest(t)

	_, refreshToken := loginAndGetTokens(t, srv, "test-admin@example.com", "TestPass1!")

	body := jsonBody(t, map[string]string{"refresh_token": refreshToken})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/logout", body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// GET /api/auth/me
// =============================================================================

// TestGetMe_Success_Admin: 正常系 - Admin ユーザーの me 情報が返ること。
func TestGetMe_Success_Admin(t *testing.T) {
	// AUTH-057
	srv, _ := setupAuthTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/auth/me", nil,
		testutil.UserAdminID, testutil.TenantAID, string(domain.RoleAdmin))

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	// openapi.yaml UserProfile スキーマ準拠: id（uuid）・name・email・role・tenant{id,name}。
	var resp struct {
		Data struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Role  string `json:"role"`
			Tenant struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"tenant"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}

	if resp.Data.ID != testutil.UserAdminID {
		t.Errorf("id が期待値と異なります: got %q, want %q", resp.Data.ID, testutil.UserAdminID)
	}
	if resp.Data.Email != "test-admin@example.com" {
		t.Errorf("email が期待値と異なります: got %q, want %q", resp.Data.Email, "test-admin@example.com")
	}
	if resp.Data.Role != "admin" {
		t.Errorf("role が期待値と異なります: got %q, want %q", resp.Data.Role, "admin")
	}
}

// TestGetMe_Success_Member: 正常系 - Member ユーザーの me 情報が返ること。
func TestGetMe_Success_Member(t *testing.T) {
	// AUTH-058
	srv, _ := setupAuthTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/auth/me", nil,
		testutil.UserMemberID, testutil.TenantAID, string(domain.RoleMember))

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Role string `json:"role"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Role != "member" {
		t.Errorf("role が期待値と異なります: got %q, want %q", resp.Data.Role, "member")
	}
}

// TestGetMe_Success_Approver: 正常系 - Approver ユーザーの me 情報が返ること。
func TestGetMe_Success_Approver(t *testing.T) {
	// AUTH-059
	srv, _ := setupAuthTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/auth/me", nil,
		testutil.UserApproverID, testutil.TenantAID, string(domain.RoleApprover))

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Role string `json:"role"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Role != "approver" {
		t.Errorf("role が期待値と異なります: got %q, want %q", resp.Data.Role, "approver")
	}
}

// TestGetMe_Success_Accounting: 正常系 - Accounting ユーザーの me 情報が返ること。
func TestGetMe_Success_Accounting(t *testing.T) {
	// AUTH-060
	srv, _ := setupAuthTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/auth/me", nil,
		testutil.UserAccountingID, testutil.TenantAID, string(domain.RoleAccounting))

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Role string `json:"role"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Role != "accounting" {
		t.Errorf("role が期待値と異なります: got %q, want %q", resp.Data.Role, "accounting")
	}
}

// TestGetMe_Unauthorized_NoToken: 異常系 - Authorization ヘッダーなしで 401 UNAUTHORIZED が返ること。
func TestGetMe_Unauthorized_NoToken(t *testing.T) {
	// AUTH-061
	srv, _ := setupAuthTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "UNAUTHORIZED")
}

// TestGetMe_Unauthorized_ExpiredToken: 異常系 - 期限切れトークンで 401 TOKEN_EXPIRED が返ること。
func TestGetMe_Unauthorized_ExpiredToken(t *testing.T) {
	// AUTH-062
	srv, _ := setupAuthTest(t)

	// テスト用の期限切れトークン文字列。
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer expired.access.token.dummy")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// TestGetMe_Unauthorized_InvalidToken: 異常系 - 不正なトークンで 401 INVALID_TOKEN が返ること。
func TestGetMe_Unauthorized_InvalidToken(t *testing.T) {
	// AUTH-063
	srv, _ := setupAuthTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer not.a.real.token")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestGetMe_Unauthorized_RefreshTokenAsAccess: 異常系 - リフレッシュトークンをアクセストークンとして使用すると 401 が返ること。
func TestGetMe_Unauthorized_RefreshTokenAsAccess(t *testing.T) {
	// AUTH-064
	srv, _ := setupAuthTest(t)

	// リフレッシュトークン文字列をアクセストークンとして使用する。
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer some.refresh.token.value")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// POST /api/auth/password-reset
// =============================================================================

// TestRequestPasswordReset_ExistingEmail: 正常系 - 既存メールアドレスで 200 と message が返ること。
func TestRequestPasswordReset_ExistingEmail(t *testing.T) {
	// AUTH-065
	srv, pool := setupAuthTest(t)

	body := jsonBody(t, map[string]string{"email": "test-admin@example.com"})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/password-reset", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Message == "" {
		t.Error("data.message が空です")
	}

	// DB にパスワードリセットトークンが作成されていることを確認する。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	var tokenCount int
	if err := conn.QueryRow(ctx,
		`SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = $1`,
		uuid.MustParse(testutil.UserAdminID),
	).Scan(&tokenCount); err != nil {
		t.Fatalf("DB クエリに失敗しました: %v", err)
	}
	if tokenCount == 0 {
		t.Error("DB にパスワードリセットトークンが作成されていません")
	}
}

// TestRequestPasswordReset_NonExistentEmail: セキュリティ - 存在しないメールでも 200 が返ること（SEC-011）。
func TestRequestPasswordReset_NonExistentEmail(t *testing.T) {
	// AUTH-066
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{"email": "nobody@example.com"})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/password-reset", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	// SEC-011: ユーザーの存在に関わらず同一のレスポンスを返す。
	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Message == "" {
		t.Error("data.message が空です")
	}
}

// TestRequestPasswordReset_ValidationError_MissingEmail: 異常系 - email を省略すると 422 VALIDATION_ERROR が返ること。
func TestRequestPasswordReset_ValidationError_MissingEmail(t *testing.T) {
	// AUTH-067
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/password-reset", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestRequestPasswordReset_ValidationError_InvalidEmail: 異常系 - 不正なメール形式で 422 VALIDATION_ERROR が返ること。
func TestRequestPasswordReset_ValidationError_InvalidEmail(t *testing.T) {
	// AUTH-068
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{"email": "not-valid"})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/password-reset", body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestRequestPasswordReset_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestRequestPasswordReset_NoAuthRequired(t *testing.T) {
	// AUTH-069
	srv, _ := setupAuthTest(t)

	body := jsonBody(t, map[string]string{"email": "test-admin@example.com"})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/password-reset", body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// PUT /api/auth/password-reset/{token}
// =============================================================================

// TestExecutePasswordReset_Success: 正常系 - 有効なトークンでパスワードリセット成功。
func TestExecutePasswordReset_Success(t *testing.T) {
	// AUTH-070
	srv, pool := setupAuthTest(t)

	// test-member@example.com 向けの有効なリセットトークンを直接 DB に挿入する。
	tokenValue := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" // 64 文字
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	memberID := uuid.MustParse(testutil.UserMemberID)
	insertPasswordResetToken(t, pool, memberID, tokenValue, expiresAt)

	newPassword := "NewPass1!"
	body := jsonBody(t, map[string]string{"new_password": newPassword})
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v", err)
	}
	if resp.Data.Message == "" {
		t.Error("data.message が空です")
	}

	// 副作用 1: password_reset_tokens.used_at が設定されていること（security.md 2.3）。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	var usedAt *time.Time
	if err := conn.QueryRow(ctx,
		`SELECT used_at FROM password_reset_tokens WHERE user_id = $1 AND token_hash = $2`,
		memberID, sha256Hex(tokenValue),
	).Scan(&usedAt); err != nil {
		t.Fatalf("password_reset_tokens の used_at 取得に失敗しました: %v", err)
	}
	if usedAt == nil {
		t.Error("password_reset_tokens.used_at が設定されていません（トークンが使用済みマークされていない）")
	}

	// 副作用 2: 対象ユーザーの全 refresh_token が無効化されていること（security.md 2.3）。
	// ログイン前に確認することで、ログインで発行される新規トークンによる誤検知を防ぐ。
	var activeCount int
	if err := conn.QueryRow(ctx,
		`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false`,
		memberID,
	).Scan(&activeCount); err != nil {
		t.Fatalf("refresh_tokens の有効件数取得に失敗しました: %v", err)
	}
	if activeCount > 0 {
		t.Errorf("パスワードリセット後も有効な refresh_token が %d 件残存しています", activeCount)
	}

	// 副作用 3: 新パスワードでログインできること（security.md 2.3）。
	// ログインで新しい refresh_token が発行されるため、token 無効化確認より後に実行する。
	_, newRefreshToken := loginAndGetTokens(t, srv, "test-member@example.com", newPassword)
	if newRefreshToken == "" {
		t.Error("新パスワードでのログインに失敗しました: refresh_token が空です")
	}
}

// TestExecutePasswordReset_InvalidToken: 異常系 - 存在しないトークンで 422 が返ること。
func TestExecutePasswordReset_InvalidToken(t *testing.T) {
	// AUTH-071
	srv, _ := setupAuthTest(t)

	nonExistentToken := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	body := jsonBody(t, map[string]string{"new_password": "NewPass1!"})
	url := fmt.Sprintf("/api/auth/password-reset/%s", nonExistentToken)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestExecutePasswordReset_ExpiredToken: 異常系 - 期限切れトークンでエラーが返ること。
func TestExecutePasswordReset_ExpiredToken(t *testing.T) {
	// AUTH-072
	srv, pool := setupAuthTest(t)

	// 期限切れのリセットトークンを直接 DB に挿入する。
	tokenValue := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	expiresAt := time.Now().UTC().Add(-30 * time.Minute) // 過去
	memberID := uuid.MustParse(testutil.UserMemberID)
	insertPasswordResetToken(t, pool, memberID, tokenValue, expiresAt)

	body := jsonBody(t, map[string]string{"new_password": "NewPass1!"})
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestExecutePasswordReset_AlreadyUsedToken: セキュリティ - 使用済みトークンで 422 が返ること（SEC-006）。
func TestExecutePasswordReset_AlreadyUsedToken(t *testing.T) {
	// AUTH-073
	srv, pool := setupAuthTest(t)

	// 使用済みトークン（used_at が設定済み）を直接 DB に挿入する。
	tokenValue := "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	memberID := uuid.MustParse(testutil.UserMemberID)

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	id := uuid.New()
	now := time.Now().UTC()
	usedAt := now.Add(-1 * time.Minute) // 1分前に使用済み
	// token_hash には SHA-256 ハッシュを保存する（db_schema.md 4.9）。
	if _, err := conn.Exec(ctx,
		`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		id, memberID, sha256Hex(tokenValue), expiresAt, usedAt, now,
	); err != nil {
		t.Fatalf("使用済みトークンの挿入に失敗しました: %v", err)
	}

	body := jsonBody(t, map[string]string{"new_password": "NewPass1!"})
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestExecutePasswordReset_ValidationError_PasswordTooShort: 境界値 - 7 文字のパスワードで 422 VALIDATION_ERROR が返ること。
func TestExecutePasswordReset_ValidationError_PasswordTooShort(t *testing.T) {
	// AUTH-074
	srv, pool := setupAuthTest(t)

	tokenValue := "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	memberID := uuid.MustParse(testutil.UserMemberID)
	insertPasswordResetToken(t, pool, memberID, tokenValue, expiresAt)

	body := jsonBody(t, map[string]string{"new_password": "short"}) // 5 文字
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestExecutePasswordReset_ValidationError_MissingPassword: 異常系 - new_password を省略すると 422 VALIDATION_ERROR が返ること。
func TestExecutePasswordReset_ValidationError_MissingPassword(t *testing.T) {
	// AUTH-075
	srv, pool := setupAuthTest(t)

	tokenValue := "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	memberID := uuid.MustParse(testutil.UserMemberID)
	insertPasswordResetToken(t, pool, memberID, tokenValue, expiresAt)

	body := jsonBody(t, map[string]string{})
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")
}

// TestExecutePasswordReset_NoAuthRequired: 正常系 - Authorization ヘッダーなしでアクセスできること。
func TestExecutePasswordReset_NoAuthRequired(t *testing.T) {
	// AUTH-076
	srv, pool := setupAuthTest(t)

	tokenValue := "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	memberID := uuid.MustParse(testutil.UserMemberID)
	insertPasswordResetToken(t, pool, memberID, tokenValue, expiresAt)

	body := jsonBody(t, map[string]string{"new_password": "NewPass1!"})
	url := fmt.Sprintf("/api/auth/password-reset/%s", tokenValue)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーを設定しない。

	rec := srv.Execute(req)

	if rec.Code == http.StatusUnauthorized {
		t.Errorf("認証不要エンドポイントが 401 を返しました: body=%s", rec.Body.String())
	}
}

// =============================================================================
// 共通セキュリティ・ミドルウェアの統合テスト
// =============================================================================

// TestAuth_AccessTokenFlow: 正常系 - サインアップ → ログイン → GET /api/auth/me の一連のフロー。
func TestAuth_AccessTokenFlow(t *testing.T) {
	// AUTH-077
	srv, _ := setupAuthTest(t)

	// Step 1: サインアップ。
	signupBody := jsonBody(t, map[string]string{
		"company_name": "Flow Corp",
		"user_name":    "Flow User",
		"email":        "flow@example.com",
		"password":     "TestPass1!",
	})
	signupReq, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/signup", signupBody)
	signupReq.Header.Set("Content-Type", "application/json")
	signupRec := srv.Execute(signupReq)
	testutil.AssertStatus(t, signupRec, http.StatusCreated)

	var signupResp authResponse
	if err := json.Unmarshal(signupRec.Body.Bytes(), &signupResp); err != nil {
		t.Fatalf("サインアップレスポンスのデコードに失敗しました: %v", err)
	}

	// Step 2: ログイン。
	loginBody := jsonBody(t, map[string]string{
		"email":    "flow@example.com",
		"password": "TestPass1!",
	})
	loginReq, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", loginBody)
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := srv.Execute(loginReq)
	testutil.AssertStatus(t, loginRec, http.StatusOK)

	var loginResp authResponse
	if err := json.Unmarshal(loginRec.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("ログインレスポンスのデコードに失敗しました: %v", err)
	}
	if loginResp.Data.AccessToken == "" {
		t.Fatal("ログインで access_token が空です")
	}

	// Step 3: GET /api/auth/me（取得したアクセストークンを使用）。
	// 実際のトークンを Bearer ヘッダーに設定する。
	meReq, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginResp.Data.AccessToken)
	meRec := srv.Execute(meReq)
	testutil.AssertStatus(t, meRec, http.StatusOK)
}

// TestAuth_InvalidAlgorithm: セキュリティ - none アルゴリズムのトークンで 401 が返ること。
func TestAuth_InvalidAlgorithm(t *testing.T) {
	// AUTH-078
	srv, _ := setupAuthTest(t)

	// none アルゴリズム（alg 混乱攻撃）のトークンを作成する。
	// 実際の none アルゴリズムトークンは "<header>.<payload>." の形式。
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0In0.")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestAuth_InvalidIssuer: セキュリティ - 不正な発行者のトークンで 401 が返ること。
func TestAuth_InvalidIssuer(t *testing.T) {
	// AUTH-079
	srv, _ := setupAuthTest(t)

	// 別の発行者でトークンを生成する（testutil の GenerateTestToken は "expense-saas" を使用するため、
	// 手動でカスタムトークンを作成する）。
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer invalid.issuer.token")

	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "INVALID_TOKEN")
}

// TestAuth_AuthEndpointsPubliclyAccessible: 正常系 - 認証不要エンドポイントが 401 を返さないこと。
func TestAuth_AuthEndpointsPubliclyAccessible(t *testing.T) {
	// AUTH-080
	srv, _ := setupAuthTest(t)

	// 各認証不要エンドポイントへのリクエストを定義する。
	type endpoint struct {
		method string
		path   string
		body   any
	}

	endpoints := []endpoint{
		{http.MethodPost, "/api/auth/signup", map[string]string{
			"company_name": "Public Corp", "user_name": "User", "email": "public@example.com", "password": "TestPass1!",
		}},
		{http.MethodPost, "/api/auth/login", map[string]string{
			"email": "test-admin@example.com", "password": "TestPass1!",
		}},
		{http.MethodPost, "/api/auth/logout", map[string]string{"refresh_token": "dummy.refresh.token"}},
		{http.MethodPost, "/api/auth/password-reset", map[string]string{"email": "test@example.com"}},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			b, _ := json.Marshal(ep.body)
			req, _ := http.NewRequestWithContext(context.Background(), ep.method, ep.path, bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			// Authorization ヘッダーを設定しない。

			rec := srv.Execute(req)

			if rec.Code == http.StatusUnauthorized {
				t.Errorf("認証不要エンドポイント %s %s が 401 を返しました", ep.method, ep.path)
			}
		})
	}
}
