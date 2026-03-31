package config

import (
	"errors"
	"os"
)

// Config holds application configuration loaded from environment variables.
type Config struct {
	DatabaseURL        string // DATABASE_URL (required)
	AppDatabaseURL     string // APP_DATABASE_URL (required)
	JWTPrivateKeyPath  string // JWT_PRIVATE_KEY_PATH
	JWTPublicKeyPath   string // JWT_PUBLIC_KEY_PATH
	CORSAllowedOrigins string // CORS_ALLOWED_ORIGINS
	LogLevel           string // LOG_LEVEL (default: "info")
	Port               string // PORT (default: "8080")
}

// LoadConfig reads configuration from environment variables and returns a Config.
// Returns an error if required variables are missing.
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
