package config

import (
	"errors"
	"os"
)

// Config は環境変数から読み込んだアプリケーション設定を保持する。
type Config struct {
	DatabaseURL        string // DATABASE_URL（必須）
	AppDatabaseURL     string // APP_DATABASE_URL（必須）
	JWTPrivateKeyPath  string // JWT_PRIVATE_KEY_PATH
	JWTPublicKeyPath   string // JWT_PUBLIC_KEY_PATH
	CORSAllowedOrigins string // CORS_ALLOWED_ORIGINS
	LogLevel           string // LOG_LEVEL（デフォルト: "info"）
	Port               string // PORT（デフォルト: "8080"）
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

	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return &Config{
		DatabaseURL:        databaseURL,
		AppDatabaseURL:     appDatabaseURL,
		JWTPrivateKeyPath:  os.Getenv("JWT_PRIVATE_KEY_PATH"),
		JWTPublicKeyPath:   os.Getenv("JWT_PUBLIC_KEY_PATH"),
		CORSAllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
		LogLevel:           logLevel,
		Port:               port,
	}, nil
}
