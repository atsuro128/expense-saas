package main

import (
	"context"
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

	// 5. JWT 鍵ファイルの検証と検証器の初期化。
	// TODO: Signer 実装時に os.Stat を NewSigner（NewVerifier と同等の PEM パース検証）に置き換える。
	if _, err := os.Stat(cfg.JWTPrivateKeyPath); err != nil {
		slog.Error("JWT private key file not found", "error", err, "path", cfg.JWTPrivateKeyPath)
		os.Exit(1)
	}
	slog.Info("JWT private key file verified", "path", cfg.JWTPrivateKeyPath)

	verifier, err := appjwt.NewVerifier(cfg.JWTPublicKeyPath)
	if err != nil {
		slog.Error("failed to initialize JWT verifier", "error", err, "path", cfg.JWTPublicKeyPath)
		os.Exit(1)
	}
	slog.Info("JWT verifier initialized", "path", cfg.JWTPublicKeyPath)

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

	// サービス。
	authSvc := service.NewAuthService(userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo)
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
