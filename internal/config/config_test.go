package config

import (
	"os"
	"testing"
)

// setEnvForTest は指定した環境変数をセットし、テスト終了時に元の値へ戻すクリーンアップを登録する。
func setEnvForTest(t *testing.T, key, value string) {
	t.Helper()
	prev, existed := os.LookupEnv(key)
	if err := os.Setenv(key, value); err != nil {
		t.Fatalf("setEnvForTest: os.Setenv(%q): %v", key, err)
	}
	t.Cleanup(func() {
		if existed {
			_ = os.Setenv(key, prev)
		} else {
			_ = os.Unsetenv(key)
		}
	})
}

// unsetEnvForTest は指定した環境変数を削除し、テスト終了時に元の値へ戻すクリーンアップを登録する。
func unsetEnvForTest(t *testing.T, key string) {
	t.Helper()
	prev, existed := os.LookupEnv(key)
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("unsetEnvForTest: os.Unsetenv(%q): %v", key, err)
	}
	t.Cleanup(func() {
		if existed {
			_ = os.Setenv(key, prev)
		}
	})
}

// setRequiredEnv は LoadConfig が必須とする環境変数を全てセットして
// テスト終了時に元の状態へ戻すクリーンアップを登録する。
func setRequiredEnv(t *testing.T) {
	t.Helper()
	setEnvForTest(t, "DATABASE_URL", "postgres://owner:pass@localhost/db")
	setEnvForTest(t, "APP_DATABASE_URL", "postgres://app:pass@localhost/db")
	setEnvForTest(t, "JWT_PRIVATE_KEY_PATH", "/tmp/private.pem")
	setEnvForTest(t, "JWT_PUBLIC_KEY_PATH", "/tmp/public.pem")
}

// =============================================================================
// parsePositiveIntEnv のユニットテスト
// =============================================================================

// TestParsePositiveIntEnv_DefaultWhenUnset は環境変数が未設定のときにデフォルト値が返ることを確認する。
func TestParsePositiveIntEnv_DefaultWhenUnset(t *testing.T) {
	unsetEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE")

	got, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err != nil {
		t.Fatalf("parsePositiveIntEnv: unexpected error: %v", err)
	}
	if got != 5 {
		t.Errorf("parsePositiveIntEnv: got %d, want %d", got, 5)
	}
}

// TestParsePositiveIntEnv_DefaultWhenEmpty は環境変数が空文字のときにデフォルト値が返ることを確認する。
func TestParsePositiveIntEnv_DefaultWhenEmpty(t *testing.T) {
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "")

	got, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err != nil {
		t.Fatalf("parsePositiveIntEnv: unexpected error: %v", err)
	}
	if got != 5 {
		t.Errorf("parsePositiveIntEnv: got %d, want %d", got, 5)
	}
}

// TestParsePositiveIntEnv_ValidOverride は正の整数で上書きされた場合にその値が返ることを確認する。
func TestParsePositiveIntEnv_ValidOverride(t *testing.T) {
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "100")

	got, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err != nil {
		t.Fatalf("parsePositiveIntEnv: unexpected error: %v", err)
	}
	if got != 100 {
		t.Errorf("parsePositiveIntEnv: got %d, want %d", got, 100)
	}
}

// TestParsePositiveIntEnv_ErrorOnNonNumeric は非数値の場合にエラーが返ることを確認する。
func TestParsePositiveIntEnv_ErrorOnNonNumeric(t *testing.T) {
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "abc")

	_, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err == nil {
		t.Fatal("parsePositiveIntEnv: expected error for non-numeric value, got nil")
	}
}

// TestParsePositiveIntEnv_ErrorOnZero は 0 の場合にエラーが返ることを確認する。
func TestParsePositiveIntEnv_ErrorOnZero(t *testing.T) {
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "0")

	_, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err == nil {
		t.Fatal("parsePositiveIntEnv: expected error for zero, got nil")
	}
}

// TestParsePositiveIntEnv_ErrorOnNegative は負数の場合にエラーが返ることを確認する。
func TestParsePositiveIntEnv_ErrorOnNegative(t *testing.T) {
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "-1")

	_, err := parsePositiveIntEnv("LOGIN_RATE_LIMIT_PER_MINUTE", 5)
	if err == nil {
		t.Fatal("parsePositiveIntEnv: expected error for negative value, got nil")
	}
}

// =============================================================================
// LoadConfig での新 env 変数テスト
// =============================================================================

// TestLoadConfig_RateLimitDefaults は LOGIN/UNAUTH env が未設定のときに
// デフォルト値（5 / 20）で Config が返ることを確認する。
func TestLoadConfig_RateLimitDefaults(t *testing.T) {
	setRequiredEnv(t)
	unsetEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE")
	unsetEnvForTest(t, "UNAUTH_RATE_LIMIT_PER_MINUTE")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: unexpected error: %v", err)
	}
	if cfg.LoginRateLimitPerMinute != 5 {
		t.Errorf("LoginRateLimitPerMinute: got %d, want %d", cfg.LoginRateLimitPerMinute, 5)
	}
	if cfg.UnauthRateLimitPerMinute != 20 {
		t.Errorf("UnauthRateLimitPerMinute: got %d, want %d", cfg.UnauthRateLimitPerMinute, 20)
	}
}

// TestLoadConfig_RateLimitOverride は LOGIN/UNAUTH env を正の整数で上書きしたとき
// その値が Config に反映されることを確認する。
func TestLoadConfig_RateLimitOverride(t *testing.T) {
	setRequiredEnv(t)
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "100")
	setEnvForTest(t, "UNAUTH_RATE_LIMIT_PER_MINUTE", "200")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: unexpected error: %v", err)
	}
	if cfg.LoginRateLimitPerMinute != 100 {
		t.Errorf("LoginRateLimitPerMinute: got %d, want %d", cfg.LoginRateLimitPerMinute, 100)
	}
	if cfg.UnauthRateLimitPerMinute != 200 {
		t.Errorf("UnauthRateLimitPerMinute: got %d, want %d", cfg.UnauthRateLimitPerMinute, 200)
	}
}

// TestLoadConfig_InvalidLoginRateLimit は LOGIN_RATE_LIMIT_PER_MINUTE に不正値を
// セットしたとき LoadConfig がエラーを返すことを確認する。
func TestLoadConfig_InvalidLoginRateLimit(t *testing.T) {
	setRequiredEnv(t)
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "invalid")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig: expected error for invalid LOGIN_RATE_LIMIT_PER_MINUTE, got nil")
	}
}

// TestLoadConfig_InvalidUnauthRateLimit は UNAUTH_RATE_LIMIT_PER_MINUTE に不正値を
// セットしたとき LoadConfig がエラーを返すことを確認する。
func TestLoadConfig_InvalidUnauthRateLimit(t *testing.T) {
	setRequiredEnv(t)
	setEnvForTest(t, "UNAUTH_RATE_LIMIT_PER_MINUTE", "0")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig: expected error for zero UNAUTH_RATE_LIMIT_PER_MINUTE, got nil")
	}
}

// TestLoadConfig_NegativeLoginRateLimit は LOGIN_RATE_LIMIT_PER_MINUTE に負数を
// セットしたとき LoadConfig がエラーを返すことを確認する。
func TestLoadConfig_NegativeLoginRateLimit(t *testing.T) {
	setRequiredEnv(t)
	setEnvForTest(t, "LOGIN_RATE_LIMIT_PER_MINUTE", "-5")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig: expected error for negative LOGIN_RATE_LIMIT_PER_MINUTE, got nil")
	}
}
