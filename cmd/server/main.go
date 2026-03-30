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

	// 7. Create router with common middleware chain.
	r := chi.NewRouter()

	// Common middleware: CORS → SecurityHeaders → RequestID → Logger → RateLimit(IP).
	r.Use(middleware.Cors(cfg.CORSAllowedOrigins))
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.RateLimitByIP(bgCtx, 20, time.Minute))

	// 8. Unauthenticated group (no additional rate limit needed).
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))
	})

	// 9. Authenticated group: Auth → TenantContext → rate-limited by user.
	// Handlers will be registered in step 8-6.
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))
		priv.Use(middleware.RateLimitByUser(bgCtx, 100, time.Minute))
		// Future handlers registered here in 8-6.
	})

	// 10. Start HTTP server.
	addr := "0.0.0.0:" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// 11. Graceful shutdown on OS signal.
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
