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
	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
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

	// 4. データベースへの疎通確認を行う。
	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connection established")

	// 5. JWT 鍵ファイルの読み込みと JWT コンポーネントの初期化。

	// 秘密鍵の読み込み（JWTGenerator 用）。
	rsaPrivKey := loadRSAPrivateKey(cfg.JWTPrivateKeyPath)
	tokenGen := domain.NewJWTGenerator(rsaPrivKey)
	slog.Info("JWT private key loaded", "path", cfg.JWTPrivateKeyPath)

	// 公開鍵から appjwt.Verifier（middleware.Auth 用）を初期化する。
	verifier, err := appjwt.NewVerifier(cfg.JWTPublicKeyPath)
	if err != nil {
		slog.Error("failed to initialize JWT verifier", "error", err, "path", cfg.JWTPublicKeyPath)
		os.Exit(1)
	}
	slog.Info("JWT verifier initialized", "path", cfg.JWTPublicKeyPath)

	// 公開鍵から domain.JWTVerifier（service 層の TokenVerifier）を初期化する。
	rsaPubKey := loadRSAPublicKey(cfg.JWTPublicKeyPath)
	tokenVerifier := domain.NewJWTVerifier(rsaPubKey)

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

	// サービス。
	authSvc := service.NewAuthService(userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo, hasher, tokenGen, tokenVerifier)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, authorizer)
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer)
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
	r.Use(middleware.RateLimitByIP(bgCtx, 20, time.Minute))

	// 9. 認証不要なルート。
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))

		pub.Post("/api/auth/signup", authHandler.Signup)
		pub.Post("/api/auth/login", authHandler.Login)
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
			all.Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.GetAttachmentDownload)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// 承認者専用。
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
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

	// 11. HTTP サーバを起動する。
	addr := "0.0.0.0:" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// 12. OS シグナル受信時にグレースフルシャットダウンを行う。
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
