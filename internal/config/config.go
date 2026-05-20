package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
)

// Config は環境変数から読み込んだアプリケーション設定を保持する。
type Config struct {
	DatabaseURL              string // DATABASE_URL（必須）
	AppDatabaseURL           string // APP_DATABASE_URL（必須）
	JWTPrivateKeyPath        string // JWT_PRIVATE_KEY_PATH
	JWTPublicKeyPath         string // JWT_PUBLIC_KEY_PATH
	CORSAllowedOrigins       string // CORS_ALLOWED_ORIGINS
	LogLevel                 string // LOG_LEVEL（デフォルト: "info"）
	Port                     string // PORT（デフォルト: "8080"）
	LoginRateLimitPerMinute  int    // LOGIN_RATE_LIMIT_PER_MINUTE（デフォルト: 5）
	UnauthRateLimitPerMinute int    // UNAUTH_RATE_LIMIT_PER_MINUTE（デフォルト: 20）
	TrustedProxyCount        int    // TRUSTED_PROXY_COUNT（デフォルト: 0）— 信頼するプロキシ段数（CloudFront+ALB の場合は 2）
}

// LoadConfig は環境変数から設定を読み込み、Config を返す。
// 必須変数が未設定の場合はエラーを返す。
func LoadConfig() (*Config, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, errors.New("environment variable DATABASE_URL is required")
	}

	appDatabaseURL := os.Getenv("APP_DATABASE_URL")
	if appDatabaseURL == "" {
		return nil, errors.New("environment variable APP_DATABASE_URL is required")
	}

	jwtPrivateKeyPath := os.Getenv("JWT_PRIVATE_KEY_PATH")
	if jwtPrivateKeyPath == "" {
		return nil, errors.New("environment variable JWT_PRIVATE_KEY_PATH is required")
	}

	jwtPublicKeyPath := os.Getenv("JWT_PUBLIC_KEY_PATH")
	if jwtPublicKeyPath == "" {
		return nil, errors.New("environment variable JWT_PUBLIC_KEY_PATH is required")
	}

	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ログインエンドポイントのレート制限値（security.md §4.4）。
	// 未設定または空文字の場合はデフォルト値 5 を使用する。
	loginRateLimit, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err != nil {
		return nil, err
	}

	// 未認証エンドポイントのグローバル IP レート制限値（security.md §4.4）。
	// 未設定または空文字の場合はデフォルト値 20 を使用する。
	unauthRateLimit, err := parsePositiveIntEnv("UNAUTH_RATE_LIMIT_PER_MINUTE", 20)
	if err != nil {
		return nil, err
	}

	// 信頼するプロキシ段数（issue #185 B-2）。
	// prod で CloudFront+ALB の 2 段構成を使う場合は 2 を設定する。
	// 未設定または空文字の場合はデフォルト値 0（dev 環境: XFF 完全無視）を使用する。
	trustedProxyCount, err := parseNonNegativeIntEnv("TRUSTED_PROXY_COUNT", 0)
	if err != nil {
		return nil, err
	}

	return &Config{
		DatabaseURL:              databaseURL,
		AppDatabaseURL:           appDatabaseURL,
		JWTPrivateKeyPath:        jwtPrivateKeyPath,
		JWTPublicKeyPath:         jwtPublicKeyPath,
		CORSAllowedOrigins:       os.Getenv("CORS_ALLOWED_ORIGINS"),
		LogLevel:                 logLevel,
		Port:                     port,
		LoginRateLimitPerMinute:  loginRateLimit,
		UnauthRateLimitPerMinute: unauthRateLimit,
		TrustedProxyCount:        trustedProxyCount,
	}, nil
}

// parsePositiveIntEnv は環境変数 key を正の整数としてパースして返す。
// 未設定または空文字の場合は defaultVal を返す。
// 不正値（非数値・0・負数）の場合はエラーを返す。
func parsePositiveIntEnv(key string, defaultVal int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("environment variable %s must be an integer: %w", key, err)
	}
	if v <= 0 {
		return 0, fmt.Errorf("environment variable %s must be a positive integer, got %d", key, v)
	}
	return v, nil
}

// parseNonNegativeIntEnv は環境変数 key を非負整数としてパースして返す。
// 未設定または空文字の場合は defaultVal を返す。
// 不正値（非数値・負数）の場合はエラーを返す。0 は有効値として許容する。
func parseNonNegativeIntEnv(key string, defaultVal int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("environment variable %s must be an integer: %w", key, err)
	}
	if v < 0 {
		return 0, fmt.Errorf("environment variable %s must be a non-negative integer, got %d", key, v)
	}
	return v, nil
}
