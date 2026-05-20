package main

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/config"
	"expense-saas/internal/domain"
	"expense-saas/internal/handler"
	"expense-saas/internal/middleware"
	appjwt "expense-saas/internal/pkg/jwt"
	pkgs3 "expense-saas/internal/pkg/s3"
	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
	"expense-saas/internal/spa"
)

func main() {
	// 1. 環境変数から設定を読み込む。
	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 2. slog の構造化ログを設定する（JSON ハンドラ使用）。
	var logLevel slog.Level
	switch cfg.LogLevel {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn", "warning":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	// 3. アプリロール用データベースの接続プールを作成する。
	pool, err := pgxpool.New(context.Background(), cfg.AppDatabaseURL)
	if err != nil {
		slog.Error("failed to create database connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// 3b. オーナーロール用データベースの接続プールを作成する。
	// 認証系エンドポイントはテナント未確定のため RLS が適用されない expense_owner ロールで接続する。
	ownerPoolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to parse owner database URL", "error", err)
		os.Exit(1)
	}
	ownerPoolCfg.MaxConns = 5
	ownerPool, err := pgxpool.NewWithConfig(context.Background(), ownerPoolCfg)
	if err != nil {
		slog.Error("failed to create owner database connection pool", "error", err)
		os.Exit(1)
	}
	defer ownerPool.Close()

	// 4. データベースへの疎通確認を行う。
	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	if err := ownerPool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping owner database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connection established")

	// 5. JWT 鍵ファイルの読み込みと JWT コンポーネントの初期化。

	// 秘密鍵の読み込み（JWTGenerator 用）。
	rsaPrivKey := loadRSAPrivateKey(cfg.JWTPrivateKeyPath)
	tokenGen := domain.NewJWTGenerator(rsaPrivKey)
	slog.Info("JWT private key loaded", "path", cfg.JWTPrivateKeyPath)

	// 公開鍵から appjwt.Verifier（middleware.Auth 用）を初期化する。
	// kid は domain.JWTGenerator が発行するトークンに設定する値と一致させる。
	verifier, err := appjwt.NewVerifier(cfg.JWTPublicKeyPath, "expense-saas-key-1")
	if err != nil {
		slog.Error("failed to initialize JWT verifier", "error", err, "path", cfg.JWTPublicKeyPath)
		os.Exit(1)
	}
	slog.Info("JWT verifier initialized", "path", cfg.JWTPublicKeyPath)

	// 公開鍵から domain.JWTVerifier（service 層の TokenVerifier）を初期化する。
	// kid は JWTGenerator が発行するトークンの kid と一致させる（security.md §2.1）。
	rsaPubKey := loadRSAPublicKey(cfg.JWTPublicKeyPath)
	tokenVerifier := domain.NewJWTVerifier(rsaPubKey, "expense-saas-key-1")

	// 6. バックグラウンド goroutine 用のコンテキストを生成する（レートリミッタのクリーンアップ等）。
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()

	// 7. リポジトリ・サービス・ハンドラを組み立てる（DI）。

	// リポジトリ。
	tenantRepo := postgres.NewTenantRepo(pool)
	userRepo := postgres.NewUserRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	categoryRepo := postgres.NewCategoryRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)
	itemRepo := postgres.NewItemRepo(pool)
	attachmentRepo := postgres.NewAttachmentRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	// 認可。
	authorizer := service.NewAuthorizer()

	// 認証ドメインサービス。
	hasher := domain.NewArgon2idHasher()

	// S3 クライアント（環境変数から設定を読み込む）。
	storageClient, err := pkgs3.NewClientFromEnv()
	if err != nil {
		slog.Error("S3 クライアントの初期化に失敗しました", "error", err)
		os.Exit(1)
	}

	// サービス。
	authSvc := service.NewAuthService(ownerPool, userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo, hasher, tokenGen, tokenVerifier)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer, storageClient)
	workflowSvc := service.NewWorkflowService(reportRepo, userRepo, membershipRepo, authorizer)
	dashboardSvc := service.NewDashboardService(reportRepo, membershipRepo)
	categorySvc := service.NewCategoryService(categoryRepo)
	tenantSvc := service.NewTenantService(tenantRepo, userRepo, membershipRepo)

	// ハンドラ。
	authHandler := handler.NewAuthHandler(authSvc)
	reportHandler := handler.NewReportHandler(reportSvc)
	itemHandler := handler.NewItemHandler(itemSvc)
	attachmentHandler := handler.NewAttachmentHandler(attachmentSvc)
	workflowHandler := handler.NewWorkflowHandler(workflowSvc)
	dashboardHandler := handler.NewDashboardHandler(dashboardSvc)
	categoryHandler := handler.NewCategoryHandler(categorySvc)
	tenantHandler := handler.NewTenantHandler(tenantSvc)

	// 8. 共通ミドルウェアチェーンを持つルータを生成する。
	r := chi.NewRouter()

	// 共通ミドルウェア: CORS → SecurityHeaders → RequestID → Logger → RateLimit(IP)。
	r.Use(middleware.Cors(cfg.CORSAllowedOrigins))
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.RateLimitByIP(bgCtx, cfg.UnauthRateLimitPerMinute, time.Minute))

	// 9. 認証不要なルート。
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))

		pub.Post("/api/auth/signup", authHandler.Signup)
		// ログイン専用レートリミット（security.md §4.4: デフォルト 5 req/min/IP、§4.5: env で上書き可）。
		// 公開ルート全体の 20 req/min より厳しい制限を個別に適用する。
		pub.With(middleware.RateLimitByIP(bgCtx, cfg.LoginRateLimitPerMinute, time.Minute)).Post("/api/auth/login", authHandler.Login)
		pub.Post("/api/auth/refresh", authHandler.RefreshToken)
		pub.Post("/api/auth/logout", authHandler.Logout)
		pub.Post("/api/auth/password-reset", authHandler.RequestPasswordReset)
		pub.Put("/api/auth/password-reset/{token}", authHandler.ExecutePasswordReset)
	})

	// 10. 認証必須グループ: Auth → TenantContext → ユーザー単位レートリミット。
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))
		priv.Use(middleware.RateLimitByUser(bgCtx, 100, time.Minute))

		// 全認証済みロール共通。
		priv.With(middleware.RequireRole("member", "approver", "admin", "accounting")).Group(func(all chi.Router) {
			all.Get("/api/auth/me", authHandler.GetMe)
			all.Get("/api/dashboard", dashboardHandler.GetDashboard)
			all.Get("/api/categories", categoryHandler.ListCategories)

			// 経費精算レポート。
			all.Get("/api/reports", reportHandler.ListMyReports)
			all.Post("/api/reports", reportHandler.CreateReport)
			all.Get("/api/reports/{id}", reportHandler.GetReport)
			all.Put("/api/reports/{id}", reportHandler.UpdateReport)
			all.Delete("/api/reports/{id}", reportHandler.DeleteReport)
			all.Post("/api/reports/{id}/submit", reportHandler.SubmitReport)

			// 経費明細。
			all.Post("/api/reports/{id}/items", itemHandler.CreateItem)
			all.Put("/api/reports/{id}/items/{itemId}", itemHandler.UpdateItem)
			all.Delete("/api/reports/{id}/items/{itemId}", itemHandler.DeleteItem)

			// 添付ファイル。
			all.With(middleware.RateLimitByUser(bgCtx, 10, time.Minute)).
				Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}/download", attachmentHandler.GetAttachmentDownload)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}/preview", attachmentHandler.GetAttachmentPreview)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// 承認者専用。
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
			approver.Get("/api/workflow/processed", workflowHandler.ListProcessedReports)
			approver.Post("/api/workflow/{id}/approve", workflowHandler.ApproveReport)
			approver.Post("/api/workflow/{id}/reject", workflowHandler.RejectReport)
		})

		// 経理専用。
		priv.With(middleware.RequireRole("accounting")).Group(func(accounting chi.Router) {
			accounting.Get("/api/workflow/payable", workflowHandler.ListPayableReports)
			accounting.Post("/api/workflow/{id}/pay", workflowHandler.MarkReportAsPaid)
		})

		// 管理者・経理共通。
		priv.With(middleware.RequireRole("admin", "accounting")).Group(func(adminAcct chi.Router) {
			adminAcct.Get("/api/reports/all", reportHandler.ListAllReports)
			adminAcct.Get("/api/tenant/members", tenantHandler.ListTenantMembers)
		})

		// 管理者専用。
		priv.With(middleware.RequireRole("admin")).Group(func(admin chi.Router) {
			admin.Get("/api/tenant", tenantHandler.GetTenant)
		})
	})

	// 11. SPA fallback ハンドラを登録する（architecture.md §4.0）。
	// ルーティング優先順位: /api/* → /health → その他（SPA fallback）。
	// chi の NotFound ハンドラと Handle("/*", ...) を組み合わせ、
	// 既存の /api/* や /health に先にマッチさせ、それ以外を SPA fallback に渡す。
	spaHandler := spa.Handler(frontendDistFS())
	r.Get("/*", spaHandler)
	r.NotFound(spaHandler)

	// 12. HTTP サーバを起動する。
	addr := "0.0.0.0:" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// 13. OS シグナル受信時にグレースフルシャットダウンを行う。
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down server")

	// バックグラウンド goroutine をキャンセルする（例: レートリミッタのクリーンアップ）。
	bgCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server stopped")
}

// loadRSAPrivateKey は PEM ファイルから RSA 秘密鍵を読み込む。
// 失敗した場合はプロセスを終了する。
func loadRSAPrivateKey(path string) *rsa.PrivateKey {
	data, err := os.ReadFile(path)
	if err != nil {
		slog.Error("failed to read private key file", "error", err, "path", path)
		os.Exit(1)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		slog.Error("failed to decode PEM block from private key file", "path", path)
		os.Exit(1)
	}

	// PKCS8 形式としてパースを試み、失敗した場合は PKCS1 形式を試みる。
	parsedKey, errPKCS8 := x509.ParsePKCS8PrivateKey(block.Bytes)
	if errPKCS8 != nil {
		pkcs1Key, errPKCS1 := x509.ParsePKCS1PrivateKey(block.Bytes)
		if errPKCS1 != nil {
			slog.Error("failed to parse private key", "pkcs8_error", errPKCS8, "pkcs1_error", errPKCS1, "path", path)
			os.Exit(1)
		}
		return pkcs1Key
	}

	rsaKey, ok := parsedKey.(*rsa.PrivateKey)
	if !ok {
		slog.Error("private key is not an RSA key", "path", path)
		os.Exit(1)
	}
	return rsaKey
}

// loadRSAPublicKey は PEM ファイルから RSA 公開鍵を読み込む。
// 失敗した場合はプロセスを終了する。
func loadRSAPublicKey(path string) *rsa.PublicKey {
	data, err := os.ReadFile(path)
	if err != nil {
		slog.Error("failed to read public key file", "error", err, "path", path)
		os.Exit(1)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		slog.Error("failed to decode PEM block from public key file", "path", path)
		os.Exit(1)
	}

	parsedKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		slog.Error("failed to parse public key", "error", err, "path", path)
		os.Exit(1)
	}

	rsaKey, ok := parsedKey.(*rsa.PublicKey)
	if !ok {
		slog.Error("public key is not an RSA key", "path", path)
		os.Exit(1)
	}
	return rsaKey
}
