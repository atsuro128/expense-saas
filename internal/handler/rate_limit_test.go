//go:build integration

package handler_test

// 非機能テスト — レート制限・レスポンスタイム（CRS-076〜CRS-088）。
//
// 対応テストケース: CRS-076〜CRS-088
// 実行には PostgreSQL が必要（-tags=integration）。
// レスポンスタイムテスト（CRS-083〜CRS-088）はローカル実行前提（E2E と同タイミング）。
//
// 実行コマンド:
//
//	go test ./internal/handler/... -v -tags=integration -run TestRateLimit
//	go test ./internal/handler/... -v -tags=integration -run TestResponseTime
//
// Traceability: test_cases/cross-cutting.md §4（非機能テスト）
//
// CRS-076 → TestRateLimit_AuthenticatedRequests_ExceedsLimit_429
// CRS-077 → TestRateLimit_Unauthenticated_Login_ExceedsLimit_429
// CRS-078 → TestRateLimit_LoginAttempts_ExceedsLimit_429
// CRS-079 → TestRateLimit_FileUpload_ExceedsLimit_429（ファイルアップロードのレート制限）
// CRS-080 → TestRateLimit_ResponseBody_ContainsRetryAfter
// CRS-081 → TestRateLimit_RateLimitHeaders_Present
// CRS-082 → TestRateLimit_DifferentUsers_IndependentLimits
// CRS-083 → TestResponseTime_GetDashboard_P95_Under500ms
// CRS-084 → TestResponseTime_ListMyReports_P95_Under500ms
// CRS-085 → TestResponseTime_ListAllReports_P95_Under500ms
// CRS-086 → TestResponseTime_GetReport_P95_Under500ms
// CRS-087 → TestResponseTime_ListPendingReports_P95_Under500ms
// CRS-088 → TestResponseTime_FileUpload_5MB_Under5s（ファイルアップロード）

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/handler"
	"expense-saas/internal/middleware"
	appjwt "expense-saas/internal/pkg/jwt"
	pkgs3 "expense-saas/internal/pkg/s3"
	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト用レート制限付きサーバー
// =============================================================================

// rateLimitedTestServer はレート制限ミドルウェアを含むテスト用サーバーを返す。
// security.md §4.1 で定義されたレート制限値を適用する。
// window は短時間のテスト実行のためにパラメータで上書き可能。
type rateLimitedTestServer struct {
	Router  http.Handler
	KeyPair *testutil.TestKeyPair
}

// newRateLimitedTestServer はレート制限ミドルウェアを含むテスト用サーバーを構築する。
// authLimit: 認証済みリクエストの制限値（100 req/window）。
// unauthLimit: 未認証リクエストの制限値（20 req/window）。
// loginLimit: ログイン試行の制限値（5 req/window）。
// uploadLimit: ファイルアップロードの制限値（10 req/window）。
// window: レート制限ウィンドウ（テスト環境では短縮可能）。
func newRateLimitedTestServer(
	t *testing.T,
	pool *pgxpool.Pool,
	authLimit, unauthLimit, loginLimit, uploadLimit int,
	window time.Duration,
) *rateLimitedTestServer {
	t.Helper()

	kp := testutil.GenerateTestKeyPair(t)
	verifier := appjwt.NewVerifierFromKey(kp.PublicKey, "expense-saas-key-1")

	// repository 層。
	tenantRepo := postgres.NewTenantRepo(pool)
	userRepo := postgres.NewUserRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	categoryRepo := postgres.NewCategoryRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)
	itemRepo := postgres.NewItemRepo(pool)
	attachmentRepo := postgres.NewAttachmentRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	// 認可チェッカー。
	authorizer := service.NewAuthorizer()

	// 認証ドメインサービス。
	hasher := domain.NewArgon2idHasher()
	tokenGen := domain.NewJWTGenerator(kp.PrivateKey)
	tokenVerifier := domain.NewJWTVerifier(kp.PublicKey, "expense-saas-key-1")

	// service 層。
	authSvc := service.NewAuthService(pool, userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo, hasher, tokenGen, tokenVerifier)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	storageClient := pkgs3.NewInMemoryClient()
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer, storageClient)
	workflowSvc := service.NewWorkflowService(reportRepo, userRepo, membershipRepo, authorizer)
	dashboardSvc := service.NewDashboardService(reportRepo, membershipRepo)
	categorySvc := service.NewCategoryService(categoryRepo)
	tenantSvc := service.NewTenantService(tenantRepo, userRepo, membershipRepo)

	// ハンドラ層。
	authHandler := handler.NewAuthHandler(authSvc)
	reportHandler := handler.NewReportHandler(reportSvc)
	itemHandler := handler.NewItemHandler(itemSvc)
	attachmentHandler := handler.NewAttachmentHandler(attachmentSvc)
	workflowHandler := handler.NewWorkflowHandler(workflowSvc)
	dashboardHandler := handler.NewDashboardHandler(dashboardSvc)
	categoryHandler := handler.NewCategoryHandler(categorySvc)
	tenantHandler := handler.NewTenantHandler(tenantSvc)

	ctx := context.Background()

	// ルーター（レート制限ミドルウェア付き）。
	// cmd/server/main.go:165 と同様に、グローバルに IP ベースのレート制限を適用する。
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	// 本番（cmd/server/main.go:165）の global ミドルウェア配置を再現する。
	// 未認証エンドポイントを含む全ルートに IP ベースのレート制限が適用される（CRS-077）。
	r.Use(middleware.RateLimitByIP(ctx, unauthLimit, window))

	// 未認証ルート（グローバル未認証レート制限 + ログイン専用レート制限を適用）。
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))
		pub.Post("/api/auth/signup", authHandler.Signup)
		pub.Post("/api/auth/refresh", authHandler.RefreshToken)
		pub.Post("/api/auth/logout", authHandler.Logout)
		pub.Post("/api/auth/password-reset", authHandler.RequestPasswordReset)
		pub.Put("/api/auth/password-reset/{token}", authHandler.ExecutePasswordReset)

		// ログインエンドポイントはグローバル IP 制限 + ログイン専用レート制限（二重）を適用する。
		// security.md §4.4: ログインエンドポイントには専用の 5 req/min/IP を適用。
		pub.With(
			middleware.RateLimitByIP(ctx, loginLimit, window),
		).Post("/api/auth/login", authHandler.Login)
	})

	// 認証済みグループ（認証済みレート制限を適用）。
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))
		// 認証済みリクエストにユーザーベースのレート制限を適用する。
		priv.Use(middleware.RateLimitByUser(ctx, authLimit, window))

		// 全認証ロール共通。
		priv.With(middleware.RequireRole("member", "approver", "admin", "accounting")).Group(func(all chi.Router) {
			all.Get("/api/auth/me", authHandler.GetMe)
			all.Get("/api/dashboard", dashboardHandler.GetDashboard)
			all.Get("/api/categories", categoryHandler.ListCategories)

			// 経費レポート。
			all.Get("/api/reports", reportHandler.ListMyReports)
			all.Post("/api/reports", reportHandler.CreateReport)
			all.Get("/api/reports/{id}", reportHandler.GetReport)
			all.Put("/api/reports/{id}", reportHandler.UpdateReport)
			all.Delete("/api/reports/{id}", reportHandler.DeleteReport)
			all.Post("/api/reports/{id}/submit", reportHandler.SubmitReport)

			// 経費項目。
			all.Post("/api/reports/{id}/items", itemHandler.CreateItem)
			all.Put("/api/reports/{id}/items/{itemId}", itemHandler.UpdateItem)
			all.Delete("/api/reports/{id}/items/{itemId}", itemHandler.DeleteItem)

			// 添付ファイル（ファイルアップロードにはアップロード専用レート制限を適用）。
			// security.md §4.4: ファイルアップロードには 10 req/min/user を適用。
			all.With(middleware.RateLimitByUser(ctx, uploadLimit, window)).
				Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}/download", attachmentHandler.GetAttachmentDownload)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}/preview", attachmentHandler.GetAttachmentPreview)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// Approver 専用。
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
			approver.Get("/api/workflow/processed", workflowHandler.ListProcessedReports)
			approver.Post("/api/workflow/{id}/approve", workflowHandler.ApproveReport)
			approver.Post("/api/workflow/{id}/reject", workflowHandler.RejectReport)
		})

		// Accounting 専用。
		priv.With(middleware.RequireRole("accounting")).Group(func(accounting chi.Router) {
			accounting.Get("/api/workflow/payable", workflowHandler.ListPayableReports)
			accounting.Post("/api/workflow/{id}/pay", workflowHandler.MarkReportAsPaid)
		})

		// Admin および Accounting 共通。
		priv.With(middleware.RequireRole("admin", "accounting")).Group(func(adminAcct chi.Router) {
			adminAcct.Get("/api/reports/all", reportHandler.ListAllReports)
			adminAcct.Get("/api/tenant/members", tenantHandler.ListTenantMembers)
		})

		// Admin 専用。
		priv.With(middleware.RequireRole("admin")).Group(func(admin chi.Router) {
			admin.Get("/api/tenant", tenantHandler.GetTenant)
		})
	})

	return &rateLimitedTestServer{
		Router:  r,
		KeyPair: kp,
	}
}

// authRequest はレート制限付きテストサーバー向けの認証済みリクエストを生成する。
func (rs *rateLimitedTestServer) authRequest(t *testing.T, method, path string, body io.Reader, userID, tenantID, role string) *http.Request {
	t.Helper()
	token := testutil.GenerateTestToken(t, userID, tenantID, role)
	req, err := http.NewRequestWithContext(context.Background(), method, path, body)
	if err != nil {
		t.Fatalf("rateLimitedTestServer.authRequest: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// execute はリクエストをルーター経由でディスパッチし、記録されたレスポンスを返す。
func (rs *rateLimitedTestServer) execute(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	rs.Router.ServeHTTP(rec, req)
	return rec
}

// =============================================================================
// §4 レート制限テスト（CRS-076〜CRS-082）
// =============================================================================
//
// テスト安定化のためウィンドウを短縮する（security.md §4.4 参照）。
// 本番値（1分）ではなく、短いウィンドウ（rateLimitTestWindow）でレート制限を検証する。

// rateLimitTestWindow はテスト用のレート制限ウィンドウ。
// 短いウィンドウを使用することでテスト後のリセット待機を回避する。
const rateLimitTestWindow = 5 * time.Second

// setupRateLimitTest はレート制限テスト用のセットアップを行う。
// pool、認証済みサーバー（フルレート制限付き）を返す。
func setupRateLimitTest(
	t *testing.T,
	authLimit, unauthLimit, loginLimit, uploadLimit int,
) (*rateLimitedTestServer, *pgxpool.Pool) {
	t.Helper()
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := newRateLimitedTestServer(t, pool, authLimit, unauthLimit, loginLimit, uploadLimit, rateLimitTestWindow)
	return srv, pool
}

// CRS-076: 認証済みリクエストのレート制限超過 → 429 Too Many Requests。
// userMember で GET /api/dashboard を limit+1 回送信し、limit+1 回目に 429 が返ることを確認する。
// security.md §4.1: 認証済みリクエスト 100 req/min（テストでは短縮ウィンドウ + 少数で検証）。
func TestRateLimit_AuthenticatedRequests_ExceedsLimit_429(t *testing.T) {
	// テスト用に制限値を小さくして高速化する。
	const limit = 3
	srv, _ := setupRateLimitTest(t, limit, 20, 5, 10)

	var lastRec *httptest.ResponseRecorder
	for i := 0; i <= limit; i++ {
		req := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		lastRec = srv.execute(req)
	}

	// limit+1 回目（最後のリクエスト）は 429 Too Many Requests が返る（CRS-076）。
	testutil.AssertStatus(t, lastRec, http.StatusTooManyRequests)
	testutil.AssertErrorCode(t, lastRec, "RATE_LIMIT_EXCEEDED")

	// Retry-After ヘッダーが含まれること。
	if lastRec.Header().Get("Retry-After") == "" {
		t.Error("TestRateLimit_AuthenticatedRequests_ExceedsLimit_429: Retry-After ヘッダーが含まれていない（CRS-076）")
	}
}

// CRS-077: 未認証リクエストのグローバル IP 制限超過 → 429 Too Many Requests。
// security.md §4.1: 未認証リクエスト 20 req/min/IP（global RateLimitByIP で実現）。
//
// 設計上の制限経路の分離:
//   - global ミドルウェア: RateLimitByIP(unauthLimit) — 全ルートに適用（CRS-077 の検証対象）
//   - ログイン専用: RateLimitByIP(loginLimit) — /api/auth/login にのみ追加適用（CRS-078 の検証対象）
//
// CRS-077 は global IP 制限（unauthLimit）を検証する。ログイン専用制限（CRS-078）との経路分離を
// 明確にするため、ログイン専用制限が二重適用されない /health エンドポイントを使用する。
// unauthLimit=5（小さく）、loginLimit=100（大きく）として、unauthLimit+1 回目の 429 が
// global RateLimitByIP(unauthLimit) で発生することを保証する。
func TestRateLimit_Unauthenticated_Login_ExceedsLimit_429(t *testing.T) {
	// unauthLimit=5（小さく）: global IP 制限を低い値に設定してすぐ発動させる。
	// loginLimit=100（大きく）: ログイン専用制限が先に発動しないようにして経路を分離する。
	// /health エンドポイントを使用: global RateLimitByIP(unauthLimit) のみ適用され、
	//   /api/auth/login の二重適用（ログイン専用制限）を受けないため、
	//   unauthLimit+1 回目の 429 が必ず global IP 制限で発生することを保証できる。
	const unauthLimit = 5
	srv, _ := setupRateLimitTest(t, 100, unauthLimit, 100, 10)

	// unauthLimit 回目までは 200 OK が返ること（global IP 制限内）。
	for i := 0; i < unauthLimit; i++ {
		req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/health", nil)
		if err != nil {
			t.Fatalf("TestRateLimit_Unauthenticated_Login_ExceedsLimit_429: request creation error: %v", err)
		}
		rec := srv.execute(req)
		// 制限内なので 200 OK が返ること（CRS-077: global IP 制限の正常経路確認）。
		if rec.Code != http.StatusOK {
			t.Errorf("TestRateLimit_Unauthenticated_Login_ExceedsLimit_429: request %d: got %d, want %d（制限内は 200 OK）",
				i+1, rec.Code, http.StatusOK)
		}
	}

	// unauthLimit+1 回目: global RateLimitByIP(unauthLimit=5) で 429 が返ること（CRS-077）。
	// この 429 はログイン専用制限（loginLimit=100 に設定）ではなく、
	// global IP 制限（unauthLimit=5）で発生していることを示す。
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/health", nil)
	if err != nil {
		t.Fatalf("TestRateLimit_Unauthenticated_Login_ExceedsLimit_429: request creation error: %v", err)
	}
	lastRec := srv.execute(req)

	testutil.AssertStatus(t, lastRec, http.StatusTooManyRequests)
	testutil.AssertErrorCode(t, lastRec, "RATE_LIMIT_EXCEEDED")

	if lastRec.Header().Get("Retry-After") == "" {
		t.Error("TestRateLimit_Unauthenticated_Login_ExceedsLimit_429: Retry-After ヘッダーが含まれていない（CRS-077）")
	}
}

// CRS-078: ログイン試行のレート制限超過 → 429 Too Many Requests。
// POST /api/auth/login を loginLimit+1 回送信し、loginLimit 回目までは 401 が返り、
// loginLimit+1 回目（i==loginLimit）で 429 が返ることを確認する。
// security.md §4.1: ログイン試行 5 req/min/IP（テストでは 3 で代用）。
//
// 各リクエストの期待ステータス:
//   - i < loginLimit: 401 INVALID_CREDENTIALS（認証情報不正 → ログイン専用制限内）
//   - i == loginLimit（loginLimit+1 回目）: 429 RATE_LIMIT_EXCEEDED + Retry-After
func TestRateLimit_LoginAttempts_ExceedsLimit_429(t *testing.T) {
	// loginLimit=3（小さく）: ログイン専用制限を低い値に設定する。
	// unauthLimit=100（大きく）: global IP 制限が先に発動して干渉しないようにする。
	// これにより i==loginLimit の 429 がログイン専用制限で発生することを保証する。
	const loginLimit = 3
	srv, _ := setupRateLimitTest(t, 100, 100, loginLimit, 10)

	for i := 0; i < loginLimit; i++ {
		body := bytes.NewBufferString(`{"email":"nonexistent@example.com","password":"WrongPass1!"}`)
		req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
		if err != nil {
			t.Fatalf("TestRateLimit_LoginAttempts_ExceedsLimit_429: request creation error: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
		rec := srv.execute(req)
		// loginLimit 回目までは 401 INVALID_CREDENTIALS が返ること（ログイン専用制限内）。
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("TestRateLimit_LoginAttempts_ExceedsLimit_429: request %d: got %d, want %d（制限内は 401）",
				i+1, rec.Code, http.StatusUnauthorized)
		}
	}

	// loginLimit+1 回目（i==loginLimit）: ログイン専用 RateLimitByIP(loginLimit=3) で 429 が返ること（CRS-078）。
	// unauthLimit=100 に設定しているため、global IP 制限の干渉を受けずにログイン専用制限のみが発動する。
	body := bytes.NewBufferString(`{"email":"nonexistent@example.com","password":"WrongPass1!"}`)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/auth/login", body)
	if err != nil {
		t.Fatalf("TestRateLimit_LoginAttempts_ExceedsLimit_429: request creation error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	lastRec := srv.execute(req)

	testutil.AssertStatus(t, lastRec, http.StatusTooManyRequests)
	testutil.AssertErrorCode(t, lastRec, "RATE_LIMIT_EXCEEDED")

	if lastRec.Header().Get("Retry-After") == "" {
		t.Error("TestRateLimit_LoginAttempts_ExceedsLimit_429: Retry-After ヘッダーが含まれていない（CRS-078）")
	}
}

// CRS-079: ファイルアップロードのレート制限超過 → 429 Too Many Requests。
// POST .../attachments を uploadLimit+1 回送信し、uploadLimit 回目までは 201/422 が返り、
// uploadLimit+1 回目（i==uploadLimit）で 429 が返ることを確認する。
// security.md §4.1: ファイルアップロード 10 req/min/user_id（テストでは 3 で代用）。
//
// 各リクエストの期待ステータス:
//   - i < uploadLimit: 201 Created または 422（バリデーション等）。アップロード専用制限内。
//   - i == uploadLimit（uploadLimit+1 回目）: 429 RATE_LIMIT_EXCEEDED + Retry-After
func TestRateLimit_FileUpload_ExceedsLimit_429(t *testing.T) {
	// uploadLimit=3（小さく）: アップロード専用制限を低い値に設定する。
	// authLimit=100（大きく）: 認証済みユーザー制限が先に発動して干渉しないようにする。
	// unauthLimit=100（大きく）: global IP 制限が先に発動して干渉しないようにする。
	// loginLimit=100（大きく）: ログイン専用制限の干渉を排除する。
	// これにより i==uploadLimit の 429 がアップロード専用制限のみで発生することを保証する。
	const uploadLimit = 3
	srv, pool := setupRateLimitTest(t, 100, 100, 100, uploadLimit)

	// アップロード先のレポートと明細を用意する（report_draft + item_draft を使用）。
	reportID := testutil.ReportDraftID
	itemID := testutil.ItemDraftID

	uploadURL := fmt.Sprintf("/api/reports/%s/items/%s/attachments", reportID, itemID)

	// uploadLimit 回目までは 201 Created または 422 が返ること（アップロード専用制限内）。
	for i := 0; i < uploadLimit; i++ {
		// ダミーの JPEG ファイル（1KB）をアップロードする。
		jpegContent := makeJPEGContentForRateLimitTest()
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreatePart(textproto.MIMEHeader{
			"Content-Disposition": []string{fmt.Sprintf(`form-data; name="file"; filename="test-%d.jpg"`, i)},
			"Content-Type":        []string{"image/jpeg"},
		})
		if err != nil {
			t.Fatalf("TestRateLimit_FileUpload_ExceedsLimit_429: CreatePart error: %v", err)
		}
		if _, err := part.Write(jpegContent); err != nil {
			t.Fatalf("TestRateLimit_FileUpload_ExceedsLimit_429: Write error: %v", err)
		}
		writer.Close()

		req := srv.authRequest(t, http.MethodPost, uploadURL, body,
			testutil.UserMemberID, testutil.TenantAID, "member")
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := srv.execute(req)

		// 制限内なので 201 Created または 422 が返ること（CRS-079）。
		// 422 はバリデーションエラー（同一ファイル名の重複等）で発生する場合がある。
		if rec.Code != http.StatusCreated && rec.Code != http.StatusUnprocessableEntity {
			t.Errorf("TestRateLimit_FileUpload_ExceedsLimit_429: request %d: got %d, want 201 or 422（制限内）",
				i+1, rec.Code)
		}
	}

	// uploadLimit+1 回目（i==uploadLimit）: アップロード専用 RateLimitByUser(uploadLimit=3) で 429 が返ること（CRS-079）。
	// authLimit=100 / unauthLimit=100 / loginLimit=100 に設定しているため、他制限の干渉を受けない。
	jpegContent := makeJPEGContentForRateLimitTest()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": []string{fmt.Sprintf(`form-data; name="file"; filename="test-%d.jpg"`, uploadLimit)},
		"Content-Type":        []string{"image/jpeg"},
	})
	if err != nil {
		t.Fatalf("TestRateLimit_FileUpload_ExceedsLimit_429: CreatePart error: %v", err)
	}
	if _, err := part.Write(jpegContent); err != nil {
		t.Fatalf("TestRateLimit_FileUpload_ExceedsLimit_429: Write error: %v", err)
	}
	writer.Close()

	req := srv.authRequest(t, http.MethodPost, uploadURL, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	lastRec := srv.execute(req)

	_ = pool // pool はフィクスチャ投入で使用済み
	testutil.AssertStatus(t, lastRec, http.StatusTooManyRequests)
	testutil.AssertErrorCode(t, lastRec, "RATE_LIMIT_EXCEEDED")

	if lastRec.Header().Get("Retry-After") == "" {
		t.Error("TestRateLimit_FileUpload_ExceedsLimit_429: Retry-After ヘッダーが含まれていない（CRS-079）")
	}
}

// makeJPEGContentForRateLimitTest は最小限の JPEG バイト列を返す（レート制限テスト用）。
// attachment_handler_test.go の makeJPEGFile と同等のヘルパー関数。
func makeJPEGContentForRateLimitTest() []byte {
	// 最小限の有効な JPEG（SOI + EOI マーカー + ダミーペイロード）。
	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10}
	// 1KB 程度のダミーデータを追加する。
	dummy := make([]byte, 1016)
	jpeg = append(jpeg, dummy...)
	jpeg = append(jpeg, 0xFF, 0xD9) // EOI マーカー
	return jpeg
}

// CRS-080: レート制限超過時のレスポンスボディが RATE_LIMIT_EXCEEDED コードを含む。
// security.md §8.2 準拠のエラーレスポンス形式の確認。
// 制限内リクエストが 200 OK、limit+1 回目が 429 であることも確認する。
func TestRateLimit_ResponseBody_ContainsRetryAfter(t *testing.T) {
	// authLimit=2（小さく）: 制限超過を素早く発動させる。
	// unauthLimit=100（大きく）: global IP 制限の干渉を排除する。
	// loginLimit=100 / uploadLimit=100: 他制限の干渉を排除する。
	const limit = 2
	srv, _ := setupRateLimitTest(t, limit, 100, 100, 100)

	// limit 回目までは 200 OK が返ること（制限内）。
	for i := 0; i < limit; i++ {
		req := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		rec := srv.execute(req)
		if rec.Code != http.StatusOK {
			t.Errorf("TestRateLimit_ResponseBody_ContainsRetryAfter: request %d: got %d, want %d（制限内は 200 OK）",
				i+1, rec.Code, http.StatusOK)
		}
	}

	// limit+1 回目: 429 が返ること。
	lastRec := srv.execute(srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member"))

	// limit+1 回目のレスポンスが 429 であることを確認する。
	testutil.AssertStatus(t, lastRec, http.StatusTooManyRequests)

	// レスポンスボディの形式確認（security.md §8.2 準拠）。
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(lastRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("TestRateLimit_ResponseBody_ContainsRetryAfter: JSON unmarshal error: %v (body: %s)", err, lastRec.Body.String())
	}

	// エラーコードの確認（CRS-080）。
	if body.Error.Code != "RATE_LIMIT_EXCEEDED" {
		t.Errorf("TestRateLimit_ResponseBody_ContainsRetryAfter: got error code %q, want %q（CRS-080）",
			body.Error.Code, "RATE_LIMIT_EXCEEDED")
	}

	// エラーメッセージの確認。
	if !strings.Contains(body.Error.Message, "Too many requests") {
		t.Errorf("TestRateLimit_ResponseBody_ContainsRetryAfter: error message does not contain 'Too many requests': got %q（CRS-080）",
			body.Error.Message)
	}

	// Retry-After ヘッダーの確認。
	if lastRec.Header().Get("Retry-After") == "" {
		t.Error("TestRateLimit_ResponseBody_ContainsRetryAfter: Retry-After ヘッダーが含まれていない（CRS-080）")
	}
}

// CRS-081: 通常のリクエストにレート制限ヘッダーが付与される。
// X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset が含まれること。
// security.md §4.3 準拠。
func TestRateLimit_RateLimitHeaders_Present(t *testing.T) {
	const limit = 100
	srv, _ := setupRateLimitTest(t, limit, 20, 5, 10)

	req := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.execute(req)

	// 200 OK: 通常のリクエストは成功する（CRS-081）。
	testutil.AssertStatus(t, rec, http.StatusOK)

	// X-RateLimit-* ヘッダーの確認（CRS-081）。
	rateLimitHeaders := []string{
		"X-RateLimit-Limit",
		"X-RateLimit-Remaining",
		"X-RateLimit-Reset",
	}
	for _, header := range rateLimitHeaders {
		if rec.Header().Get(header) == "" {
			t.Errorf("TestRateLimit_RateLimitHeaders_Present: %s ヘッダーが含まれていない（CRS-081）", header)
		}
	}
}

// CRS-082: 異なるユーザーのレート制限カウンターが独立している。
// userMember と userAccounting がそれぞれリクエストを送信し、
// 互いのカウンターに影響しないことを確認する。
// security.md §4.2: user_id ベースのレート制限は独立。
func TestRateLimit_DifferentUsers_IndependentLimits(t *testing.T) {
	// テスト用に制限値を設定する。
	// authLimit（user 制限）= 5: userMember が limit 回送信後に超過することを確認する。
	// unauthLimit（IP 制限）= 100: IP 制限は user 制限の 20 倍に設定し、
	//   user 独立性検証中に IP 制限が先に発動しないようにする。
	//   warning-1 の本番再現意図（global ミドルウェア配置）は維持しつつ、
	//   このテストでは IP 制限を意図的に緩めることで user 独立性検証に集中できる。
	const limit = 5
	srv, _ := setupRateLimitTest(t, limit, 100, 5, 10)

	// userMember は limit 回、userAccounting は limit-1 回リクエストを送信する。
	// ループを limit-1 回にすることで、accounting は user limit に到達しない状態を維持する。
	// （limit 回ループすると accounting も limit に達し、ループ後の検証で 429 になってしまう）
	for i := 0; i < limit-1; i++ {
		reqMember := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		recMember := srv.execute(reqMember)

		reqAccounting := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
			testutil.UserAccountingID, testutil.TenantAID, "accounting")
		recAccounting := srv.execute(reqAccounting)

		// 制限内なので 200 OK が返ること（CRS-082）。
		if recMember.Code != http.StatusOK {
			t.Errorf("TestRateLimit_DifferentUsers_IndependentLimits: userMember request %d: unexpected status %d", i+1, recMember.Code)
		}
		if recAccounting.Code != http.StatusOK {
			t.Errorf("TestRateLimit_DifferentUsers_IndependentLimits: userAccounting request %d: unexpected status %d", i+1, recAccounting.Code)
		}
	}

	// userMember を limit 回目（最後の許容リクエスト）まで送信して制限に到達させる。
	// この時点で member は 通算 limit 回送信済み、accounting は limit-1 回送信済み。
	reqMemberFinal := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	srv.execute(reqMemberFinal)

	// userMember を limit+1 回目（超過）まで送信する。
	// userAccounting は limit-1 回送信済みなので、user 制限にはまだ余裕がある。
	reqMemberOver := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	recMemberOver := srv.execute(reqMemberOver)

	// userMember は制限超過で 429 Too Many Requests が返ること（CRS-082）。
	testutil.AssertStatus(t, recMemberOver, http.StatusTooManyRequests)

	// userAccounting は userMember のカウンターに影響されず、limit-1 回しか送信していないため
	// 200 OK が返ること。user_id ベースのレート制限の独立性を確認する（CRS-082）。
	reqAccountingAfter := srv.authRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	recAccountingAfter := srv.execute(reqAccountingAfter)
	testutil.AssertStatus(t, recAccountingAfter, http.StatusOK)
}

// =============================================================================
// §4 レスポンスタイムテスト（CRS-083〜CRS-088）
// =============================================================================
//
// 軽量スモークテスト: 各エンドポイントに対して複数回リクエストを送信し、
// p95 レスポンスタイムが閾値以内であることを確認する。
// test_strategy.md §2.3: ローカル実行前提（E2E テストと同タイミング）。

// calcP95 はレスポンスタイムスライスから p95 パーセンタイル値を計算して返す。
func calcP95(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	sorted := make([]time.Duration, len(durations))
	copy(sorted, durations)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	idx := int(math.Ceil(float64(len(sorted))*0.95)) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

// p95threshold は API レスポンスタイムの p95 閾値。
// requirements.md §4.1: 500ms 以下。
const p95threshold = 500 * time.Millisecond

// CRS-083: GET /api/dashboard の p95 レスポンスタイムが 500ms 以下。
func TestResponseTime_GetDashboard_P95_Under500ms(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	const iterations = 20
	durations := make([]time.Duration, 0, iterations)

	for i := 0; i < iterations; i++ {
		req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		start := time.Now()
		rec := srv.Execute(req)
		elapsed := time.Since(start)

		if rec.Code != http.StatusOK {
			t.Fatalf("TestResponseTime_GetDashboard_P95_Under500ms: 反復 %d: unexpected status %d (body: %s)", i+1, rec.Code, rec.Body.String())
		}
		durations = append(durations, elapsed)
	}

	p95 := calcP95(durations)
	t.Logf("TestResponseTime_GetDashboard_P95_Under500ms: p95=%.2fms（CRS-083）", float64(p95)/float64(time.Millisecond))

	if p95 > p95threshold {
		t.Errorf("TestResponseTime_GetDashboard_P95_Under500ms: p95=%.2fms が閾値 %v を超過（CRS-083）",
			float64(p95)/float64(time.Millisecond), p95threshold)
	}
}

// CRS-084: GET /api/reports の p95 レスポンスタイムが 500ms 以下。
func TestResponseTime_ListMyReports_P95_Under500ms(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	const iterations = 20
	durations := make([]time.Duration, 0, iterations)

	for i := 0; i < iterations; i++ {
		req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		start := time.Now()
		rec := srv.Execute(req)
		elapsed := time.Since(start)

		if rec.Code != http.StatusOK {
			t.Fatalf("TestResponseTime_ListMyReports_P95_Under500ms: 反復 %d: unexpected status %d", i+1, rec.Code)
		}
		durations = append(durations, elapsed)
	}

	p95 := calcP95(durations)
	t.Logf("TestResponseTime_ListMyReports_P95_Under500ms: p95=%.2fms（CRS-084）", float64(p95)/float64(time.Millisecond))

	if p95 > p95threshold {
		t.Errorf("TestResponseTime_ListMyReports_P95_Under500ms: p95=%.2fms が閾値 %v を超過（CRS-084）",
			float64(p95)/float64(time.Millisecond), p95threshold)
	}
}

// CRS-085: GET /api/reports/all の p95 レスポンスタイムが 500ms 以下。
func TestResponseTime_ListAllReports_P95_Under500ms(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	const iterations = 20
	durations := make([]time.Duration, 0, iterations)

	for i := 0; i < iterations; i++ {
		req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all", nil,
			testutil.UserAdminID, testutil.TenantAID, "admin")
		start := time.Now()
		rec := srv.Execute(req)
		elapsed := time.Since(start)

		if rec.Code != http.StatusOK {
			t.Fatalf("TestResponseTime_ListAllReports_P95_Under500ms: 反復 %d: unexpected status %d", i+1, rec.Code)
		}
		durations = append(durations, elapsed)
	}

	p95 := calcP95(durations)
	t.Logf("TestResponseTime_ListAllReports_P95_Under500ms: p95=%.2fms（CRS-085）", float64(p95)/float64(time.Millisecond))

	if p95 > p95threshold {
		t.Errorf("TestResponseTime_ListAllReports_P95_Under500ms: p95=%.2fms が閾値 %v を超過（CRS-085）",
			float64(p95)/float64(time.Millisecond), p95threshold)
	}
}

// CRS-086: GET /api/reports/{id} の p95 レスポンスタイムが 500ms 以下。
func TestResponseTime_GetReport_P95_Under500ms(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	const iterations = 20
	url := "/api/reports/" + testutil.ReportDraftID
	durations := make([]time.Duration, 0, iterations)

	for i := 0; i < iterations; i++ {
		req := srv.AuthRequest(t, http.MethodGet, url, nil,
			testutil.UserMemberID, testutil.TenantAID, "member")
		start := time.Now()
		rec := srv.Execute(req)
		elapsed := time.Since(start)

		if rec.Code != http.StatusOK {
			t.Fatalf("TestResponseTime_GetReport_P95_Under500ms: 反復 %d: unexpected status %d", i+1, rec.Code)
		}
		durations = append(durations, elapsed)
	}

	p95 := calcP95(durations)
	t.Logf("TestResponseTime_GetReport_P95_Under500ms: p95=%.2fms（CRS-086）", float64(p95)/float64(time.Millisecond))

	if p95 > p95threshold {
		t.Errorf("TestResponseTime_GetReport_P95_Under500ms: p95=%.2fms が閾値 %v を超過（CRS-086）",
			float64(p95)/float64(time.Millisecond), p95threshold)
	}
}

// CRS-087: GET /api/workflow/pending の p95 レスポンスタイムが 500ms 以下。
func TestResponseTime_ListPendingReports_P95_Under500ms(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	const iterations = 20
	durations := make([]time.Duration, 0, iterations)

	for i := 0; i < iterations; i++ {
		req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
			testutil.UserApproverID, testutil.TenantAID, "approver")
		start := time.Now()
		rec := srv.Execute(req)
		elapsed := time.Since(start)

		if rec.Code != http.StatusOK {
			t.Fatalf("TestResponseTime_ListPendingReports_P95_Under500ms: 反復 %d: unexpected status %d", i+1, rec.Code)
		}
		durations = append(durations, elapsed)
	}

	p95 := calcP95(durations)
	t.Logf("TestResponseTime_ListPendingReports_P95_Under500ms: p95=%.2fms（CRS-087）", float64(p95)/float64(time.Millisecond))

	if p95 > p95threshold {
		t.Errorf("TestResponseTime_ListPendingReports_P95_Under500ms: p95=%.2fms が閾値 %v を超過（CRS-087）",
			float64(p95)/float64(time.Millisecond), p95threshold)
	}
}

// CRS-088: 5MB ファイルのアップロードが 5 秒以下で完了すること。
// requirements.md §4.1: ファイルアップロード（5MB）5 秒以下。
// テスト環境（インメモリ S3 モック）では実ストレージへの通信は行わない。
func TestResponseTime_FileUpload_5MB_Under5s(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)

	// 5MB のダミー PDF を生成する。
	const targetSize = 5 * 1024 * 1024 // 5MB
	pdfContent := make5MBPDFContent(targetSize)

	reportID := testutil.ReportDraftID
	itemID := testutil.ItemDraftID
	uploadURL := fmt.Sprintf("/api/reports/%s/items/%s/attachments", reportID, itemID)

	// multipart リクエストを構築する。
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": []string{`form-data; name="file"; filename="large_receipt.pdf"`},
		"Content-Type":        []string{"application/pdf"},
	})
	if err != nil {
		t.Fatalf("TestResponseTime_FileUpload_5MB_Under5s: CreatePart error: %v", err)
	}
	if _, err := part.Write(pdfContent); err != nil {
		t.Fatalf("TestResponseTime_FileUpload_5MB_Under5s: Write error: %v", err)
	}
	writer.Close()

	req := srv.AuthRequest(t, http.MethodPost, uploadURL, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	req.Header.Set("Content-Type", writer.FormDataContentType())

	const uploadThreshold = 5 * time.Second
	start := time.Now()
	rec := srv.Execute(req)
	elapsed := time.Since(start)

	t.Logf("TestResponseTime_FileUpload_5MB_Under5s: elapsed=%.2fms, status=%d（CRS-088）",
		float64(elapsed)/float64(time.Millisecond), rec.Code)

	// 201 Created または 422（バリデーションエラー）を期待する。
	// テスト環境（インメモリ S3 モック）では実際のストレージ通信なしでアップロード処理が行われる。
	// cross-cutting.md §4 CRS-088: アップロード完了まで 5 秒以下であること（ステータス検証を含む）。
	if rec.Code != http.StatusCreated && rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("TestResponseTime_FileUpload_5MB_Under5s: unexpected status %d, want 201 or 422 (body: %s)（CRS-088）",
			rec.Code, rec.Body.String())
	}

	// 5 秒閾値の確認（CRS-088）。
	if elapsed > uploadThreshold {
		t.Errorf("TestResponseTime_FileUpload_5MB_Under5s: elapsed=%.2fms が閾値 %v を超過（CRS-088）",
			float64(elapsed)/float64(time.Millisecond), uploadThreshold)
	}
}

// make5MBPDFContent は指定サイズの PDF バイト列を生成する（CRS-088 用）。
func make5MBPDFContent(size int) []byte {
	// 最小限の PDF ヘッダー。
	header := []byte("%PDF-1.4\n")
	// 残りはダミーデータで埋める。
	padding := make([]byte, size-len(header))
	return append(header, padding...)
}
