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
	// 1. Load configuration from environment variables.
	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Configure structured logging with slog (JSON handler).
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

	// 3. Create connection pool for app role database.
	pool, err := pgxpool.New(context.Background(), cfg.AppDatabaseURL)
	if err != nil {
		slog.Error("failed to create database connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// 4. Verify database reachability.
	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connection established")

	// 5. Initialize JWT verifier (non-fatal: warn and continue when key file is absent).
	var verifier *appjwt.Verifier
	if cfg.JWTPublicKeyPath != "" {
		v, jwtErr := appjwt.NewVerifier(cfg.JWTPublicKeyPath)
		if jwtErr != nil {
			slog.Warn("JWT verifier initialization failed; authenticated endpoints will return 401",
				"error", jwtErr,
				"path", cfg.JWTPublicKeyPath,
			)
		} else {
			verifier = v
			slog.Info("JWT verifier initialized", "path", cfg.JWTPublicKeyPath)
		}
	} else {
		slog.Warn("JWT_PUBLIC_KEY_PATH is not set; authenticated endpoints will return 401")
	}

	// 6. Context for background goroutines (rate limiter cleanup etc.).
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()

	// 7. Wire up repositories, services, and handlers (DI).

	// Repositories.
	tenantRepo := postgres.NewTenantRepo(pool)
	userRepo := postgres.NewUserRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	categoryRepo := postgres.NewCategoryRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)
	itemRepo := postgres.NewItemRepo(pool)
	attachmentRepo := postgres.NewAttachmentRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	// Authorizer.
	authorizer := service.NewAuthorizer()

	// Services.
	authSvc := service.NewAuthService(userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, authorizer)
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer)
	workflowSvc := service.NewWorkflowService(reportRepo, userRepo, membershipRepo, authorizer)
	dashboardSvc := service.NewDashboardService(reportRepo, membershipRepo)
	categorySvc := service.NewCategoryService(categoryRepo)
	tenantSvc := service.NewTenantService(tenantRepo, userRepo, membershipRepo)

	// Handlers.
	authHandler := handler.NewAuthHandler(authSvc)
	reportHandler := handler.NewReportHandler(reportSvc)
	itemHandler := handler.NewItemHandler(itemSvc)
	attachmentHandler := handler.NewAttachmentHandler(attachmentSvc)
	workflowHandler := handler.NewWorkflowHandler(workflowSvc)
	dashboardHandler := handler.NewDashboardHandler(dashboardSvc)
	categoryHandler := handler.NewCategoryHandler(categorySvc)
	tenantHandler := handler.NewTenantHandler(tenantSvc)

	// 8. Create router with common middleware chain.
	r := chi.NewRouter()

	// Common middleware: CORS → SecurityHeaders → RequestID → Logger → RateLimit(IP).
	r.Use(middleware.Cors(cfg.CORSAllowedOrigins))
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.RateLimitByIP(bgCtx, 20, time.Minute))

	// 9. Unauthenticated routes.
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))

		pub.Post("/api/auth/signup", authHandler.Signup)
		pub.Post("/api/auth/login", authHandler.Login)
		pub.Post("/api/auth/refresh", authHandler.RefreshToken)
		pub.Post("/api/auth/logout", authHandler.Logout)
		pub.Post("/api/auth/password-reset", authHandler.RequestPasswordReset)
		pub.Put("/api/auth/password-reset/{token}", authHandler.ExecutePasswordReset)
	})

	// 10. Authenticated group: Auth → TenantContext → rate-limited by user.
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))
		priv.Use(middleware.RateLimitByUser(bgCtx, 100, time.Minute))

		// All authenticated roles.
		priv.With(middleware.RequireRole("member", "approver", "admin", "accounting")).Group(func(all chi.Router) {
			all.Get("/api/auth/me", authHandler.GetMe)
			all.Get("/api/dashboard", dashboardHandler.GetDashboard)
			all.Get("/api/categories", categoryHandler.ListCategories)

			// Reports.
			all.Get("/api/reports", reportHandler.ListMyReports)
			all.Post("/api/reports", reportHandler.CreateReport)
			all.Get("/api/reports/{id}", reportHandler.GetReport)
			all.Put("/api/reports/{id}", reportHandler.UpdateReport)
			all.Delete("/api/reports/{id}", reportHandler.DeleteReport)
			all.Post("/api/reports/{id}/submit", reportHandler.SubmitReport)

			// Items.
			all.Post("/api/reports/{id}/items", itemHandler.CreateItem)
			all.Put("/api/reports/{id}/items/{itemId}", itemHandler.UpdateItem)
			all.Delete("/api/reports/{id}/items/{itemId}", itemHandler.DeleteItem)

			// Attachments.
			all.Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.GetAttachmentDownload)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// Approver only.
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
			approver.Post("/api/workflow/{id}/approve", workflowHandler.ApproveReport)
			approver.Post("/api/workflow/{id}/reject", workflowHandler.RejectReport)
		})

		// Accounting only.
		priv.With(middleware.RequireRole("accounting")).Group(func(accounting chi.Router) {
			accounting.Get("/api/workflow/payable", workflowHandler.ListPayableReports)
			accounting.Post("/api/workflow/{id}/pay", workflowHandler.MarkReportAsPaid)
		})

		// Admin and Accounting.
		priv.With(middleware.RequireRole("admin", "accounting")).Group(func(adminAcct chi.Router) {
			adminAcct.Get("/api/reports/all", reportHandler.ListAllReports)
			adminAcct.Get("/api/tenant/members", tenantHandler.ListTenantMembers)
		})

		// Admin only.
		priv.With(middleware.RequireRole("admin")).Group(func(admin chi.Router) {
			admin.Get("/api/tenant", tenantHandler.GetTenant)
		})
	})

	// 11. Start HTTP server.
	addr := "0.0.0.0:" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// 12. Graceful shutdown on OS signal.
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

	// Cancel background goroutines (e.g., rate limiter cleanup).
	bgCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server stopped")
}
