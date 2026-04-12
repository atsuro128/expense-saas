package testutil

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
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
)

// TestServer は認証済み HTTP リクエストを発行するテストヘルパーを備えた chi.Router のラッパー。
type TestServer struct {
	Router  http.Handler
	Pool    *pgxpool.Pool
	KeyPair *TestKeyPair
}

// NewTestServer は main.go と同等のアプリケーションルーターを構成して返す。
// ただし、テストに干渉するレート制限ミドルウェアは含まない。
// ルーターは指定された pool をバックエンドとし、テスト用 JWT 鍵ペアで認証する。
func NewTestServer(t *testing.T, pool *pgxpool.Pool) *TestServer {
	t.Helper()

	kp := GenerateTestKeyPair(t)
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

	// 認証ドメインサービス（Argon2id + JWT）。
	hasher := domain.NewArgon2idHasher()
	tokenGen := domain.NewJWTGenerator(kp.PrivateKey)
	tokenVerifier := domain.NewJWTVerifier(kp.PublicKey, "expense-saas-key-1")

	// service 層。
	authSvc := service.NewAuthService(pool, userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo, hasher, tokenGen, tokenVerifier)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	// テスト用インメモリ S3 モック（実際のストレージへのアクセスを行わない）。
	// presignedURLExpiry はテスト用デフォルト値（15 分）を使用する。
	storageClient := pkgs3.NewInMemoryClient()
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer, storageClient, 15*time.Minute)
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

	// ルーター（テストではレート制限・CORS なし）。
	r := chi.NewRouter()
	r.Use(middleware.RequestID)

	// 未認証ルート。
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))

		pub.Post("/api/auth/signup", authHandler.Signup)
		pub.Post("/api/auth/login", authHandler.Login)
		pub.Post("/api/auth/refresh", authHandler.RefreshToken)
		pub.Post("/api/auth/logout", authHandler.Logout)
		pub.Post("/api/auth/password-reset", authHandler.RequestPasswordReset)
		pub.Put("/api/auth/password-reset/{token}", authHandler.ExecutePasswordReset)
	})

	// 認証済みグループ。
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))

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

			// 添付ファイル。
			all.Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.GetAttachmentDownload)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// Approver 専用。
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
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

	return &TestServer{
		Router:  r,
		Pool:    pool,
		KeyPair: kp,
	}
}

// AuthRequest はテストサーバー向けの認証済み HTTP リクエストを生成する。
// GET や DELETE などボディなしのリクエストでは body に nil を渡す。
func (ts *TestServer) AuthRequest(t *testing.T, method, path string, body io.Reader, userID, tenantID, role string) *http.Request {
	t.Helper()

	token := GenerateTestToken(t, userID, tenantID, role)

	req, err := http.NewRequestWithContext(context.Background(), method, path, body)
	if err != nil {
		t.Fatalf("testutil: AuthRequest: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// Execute はリクエストをルーター経由でディスパッチし、記録されたレスポンスを返す。
func (ts *TestServer) Execute(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	ts.Router.ServeHTTP(rec, req)
	return rec
}

// NewAuthenticatedRequest は共有テスト鍵ペアから生成した Bearer トークンを持つ
// http.Request を構築するスタンドアロンヘルパー。
// body には nil を渡せる。
func NewAuthenticatedRequest(t *testing.T, method, target string, body io.Reader, userID, tenantID, role string) *http.Request {
	t.Helper()

	token := GenerateTestToken(t, userID, tenantID, role)
	req, err := http.NewRequestWithContext(context.Background(), method, target, body)
	if err != nil {
		t.Fatalf("testutil: NewAuthenticatedRequest: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// SetRequestTimeout はリクエストコンテキストにデッドラインを設定する（低速な統合テスト向け）。
// コンテキストリークを防ぐため、cancel 関数は t.Cleanup に登録する。
func SetRequestTimeout(t *testing.T, req *http.Request, d time.Duration) *http.Request {
	ctx, cancel := context.WithTimeout(req.Context(), d)
	t.Cleanup(cancel)
	return req.WithContext(ctx)
}
