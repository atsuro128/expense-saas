package config_test

import (
	"os"
	"testing"
	"time"

	"expense-saas/internal/config"
)

// setRequiredEnv は LoadConfig が必須とする環境変数をテスト用にセットする。
// 返り値のクリーンアップ関数を t.Cleanup に渡すこと。
func setRequiredEnv(t *testing.T) {
	t.Helper()
	envs := map[string]string{
		"DATABASE_URL":        "postgres://owner:pass@localhost:5432/testdb?sslmode=disable",
		"APP_DATABASE_URL":    "postgres://app:pass@localhost:5432/testdb?sslmode=disable",
		"JWT_PRIVATE_KEY_PATH": "/tmp/test-private.pem",
		"JWT_PUBLIC_KEY_PATH":  "/tmp/test-public.pem",
	}
	for k, v := range envs {
		orig, exists := os.LookupEnv(k)
		if err := os.Setenv(k, v); err != nil {
			t.Fatalf("os.Setenv(%q): %v", k, err)
		}
		k, orig, exists := k, orig, exists
		t.Cleanup(func() {
			if exists {
				os.Setenv(k, orig) //nolint:errcheck
			} else {
				os.Unsetenv(k) //nolint:errcheck
			}
		})
	}
}

// TestLoadConfig_S3PresignedURLExpiry_Default は S3_PRESIGNED_URL_EXPIRY 未設定時に
// デフォルト値 15 分が使われることを確認する。
func TestLoadConfig_S3PresignedURLExpiry_Default(t *testing.T) {
	setRequiredEnv(t)

	// S3_PRESIGNED_URL_EXPIRY が設定されている場合はアンセットして未設定状態を作る。
	orig, exists := os.LookupEnv("S3_PRESIGNED_URL_EXPIRY")
	if err := os.Unsetenv("S3_PRESIGNED_URL_EXPIRY"); err != nil {
		t.Fatalf("os.Unsetenv: %v", err)
	}
	t.Cleanup(func() {
		if exists {
			os.Setenv("S3_PRESIGNED_URL_EXPIRY", orig) //nolint:errcheck
		}
	})

	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() error = %v, want nil", err)
	}
	if cfg.S3PresignedURLExpiry != 15*time.Minute {
		t.Errorf("S3PresignedURLExpiry = %v, want %v", cfg.S3PresignedURLExpiry, 15*time.Minute)
	}
}

// TestLoadConfig_S3PresignedURLExpiry_Custom は S3_PRESIGNED_URL_EXPIRY=30m 設定時に
// 30 分が返されることを確認する。
func TestLoadConfig_S3PresignedURLExpiry_Custom(t *testing.T) {
	setRequiredEnv(t)

	orig, exists := os.LookupEnv("S3_PRESIGNED_URL_EXPIRY")
	if err := os.Setenv("S3_PRESIGNED_URL_EXPIRY", "30m"); err != nil {
		t.Fatalf("os.Setenv: %v", err)
	}
	t.Cleanup(func() {
		if exists {
			os.Setenv("S3_PRESIGNED_URL_EXPIRY", orig) //nolint:errcheck
		} else {
			os.Unsetenv("S3_PRESIGNED_URL_EXPIRY") //nolint:errcheck
		}
	})

	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() error = %v, want nil", err)
	}
	if cfg.S3PresignedURLExpiry != 30*time.Minute {
		t.Errorf("S3PresignedURLExpiry = %v, want %v", cfg.S3PresignedURLExpiry, 30*time.Minute)
	}
}

// TestLoadConfig_S3PresignedURLExpiry_Invalid は S3_PRESIGNED_URL_EXPIRY に不正値を設定した場合に
// LoadConfig がエラーを返すことを確認する。
func TestLoadConfig_S3PresignedURLExpiry_Invalid(t *testing.T) {
	setRequiredEnv(t)

	orig, exists := os.LookupEnv("S3_PRESIGNED_URL_EXPIRY")
	if err := os.Setenv("S3_PRESIGNED_URL_EXPIRY", "invalid"); err != nil {
		t.Fatalf("os.Setenv: %v", err)
	}
	t.Cleanup(func() {
		if exists {
			os.Setenv("S3_PRESIGNED_URL_EXPIRY", orig) //nolint:errcheck
		} else {
			os.Unsetenv("S3_PRESIGNED_URL_EXPIRY") //nolint:errcheck
		}
	})

	_, err := config.LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() error = nil, want non-nil error for invalid S3_PRESIGNED_URL_EXPIRY")
	}
}
