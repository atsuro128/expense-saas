package s3

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestNewClientFromEnv_Initialization は NewClientFromEnv が各種環境変数の組み合わせで
// エラーなく初期化できることを確認する。
func TestNewClientFromEnv_Initialization(t *testing.T) {
	tests := []struct {
		name         string
		envVars      map[string]string
		wantErr      bool
	}{
		{
			name: "S3_ENDPOINT のみ設定（S3_PUBLIC_ENDPOINT 未設定はフォールバック）",
			envVars: map[string]string{
				"S3_ENDPOINT":          "http://minio:9000",
				"AWS_ACCESS_KEY_ID":    "minioadmin",
				"AWS_SECRET_ACCESS_KEY": "minioadmin",
				"S3_BUCKET":            "test-bucket",
				"AWS_REGION":           "ap-northeast-1",
			},
			wantErr: false,
		},
		{
			name: "S3_ENDPOINT と S3_PUBLIC_ENDPOINT を両方設定",
			envVars: map[string]string{
				"S3_ENDPOINT":          "http://minio:9000",
				"S3_PUBLIC_ENDPOINT":   "http://localhost:9000",
				"AWS_ACCESS_KEY_ID":    "minioadmin",
				"AWS_SECRET_ACCESS_KEY": "minioadmin",
				"S3_BUCKET":            "test-bucket",
				"AWS_REGION":           "ap-northeast-1",
			},
			wantErr: false,
		},
		{
			name: "全環境変数未設定（AWS デフォルト認証・エンドポイント）",
			envVars: map[string]string{
				"S3_BUCKET": "test-bucket",
			},
			wantErr: false,
		},
		{
			name: "S3_PUBLIC_ENDPOINT のみ設定（S3_ENDPOINT 未設定）",
			envVars: map[string]string{
				"S3_PUBLIC_ENDPOINT":   "http://localhost:9000",
				"AWS_ACCESS_KEY_ID":    "minioadmin",
				"AWS_SECRET_ACCESS_KEY": "minioadmin",
				"S3_BUCKET":            "test-bucket",
				"AWS_REGION":           "ap-northeast-1",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 環境変数を一時的に設定する。
			clearEnvVars(t, "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "AWS_ACCESS_KEY_ID",
				"AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION")
			for k, v := range tt.envVars {
				t.Setenv(k, v)
			}

			client, err := NewClientFromEnv()
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClientFromEnv() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && client == nil {
				t.Error("NewClientFromEnv() returned nil client without error")
			}
		})
	}
}

// TestPresignGetObject_EndpointInURL は S3_PUBLIC_ENDPOINT が署名付き URL のホスト部に
// 反映されることを確認する。MinIO 互換サーバーをモックして検証する。
func TestPresignGetObject_EndpointInURL(t *testing.T) {
	// モック S3 サーバーを起動する（プリサイン URL 生成は実際に HTTP を発行しないが、
	// エンドポイントの反映を URL 文字列で確認する）。
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer mockServer.Close()

	t.Run("S3_PUBLIC_ENDPOINT が署名付き URL ホストに反映される", func(t *testing.T) {
		clearEnvVars(t, "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "AWS_ACCESS_KEY_ID",
			"AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION")
		t.Setenv("S3_ENDPOINT", "http://minio:9000")
		t.Setenv("S3_PUBLIC_ENDPOINT", mockServer.URL)
		t.Setenv("AWS_ACCESS_KEY_ID", "minioadmin")
		t.Setenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
		t.Setenv("S3_BUCKET", "test-bucket")
		t.Setenv("AWS_REGION", "ap-northeast-1")

		c, err := NewClientFromEnv()
		if err != nil {
			t.Fatalf("NewClientFromEnv() error = %v", err)
		}

		url, _, err := c.PresignGetObject(context.Background(), "test/file.pdf", "receipt.pdf", "application/pdf", time.Hour)
		if err != nil {
			t.Fatalf("PresignGetObject() error = %v", err)
		}

		// 署名付き URL が S3_PUBLIC_ENDPOINT のホストを含むことを確認する。
		if !strings.Contains(url, mockServer.URL) {
			t.Errorf("PresignGetObject() URL = %q, want to contain %q", url, mockServer.URL)
		}

		// 内部ホスト名 minio が URL に含まれていないことを確認する。
		if strings.Contains(url, "minio:9000") {
			t.Errorf("PresignGetObject() URL = %q, must not contain internal hostname minio:9000", url)
		}
	})

	t.Run("S3_PUBLIC_ENDPOINT 未設定時は S3_ENDPOINT にフォールバックする", func(t *testing.T) {
		clearEnvVars(t, "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "AWS_ACCESS_KEY_ID",
			"AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION")
		t.Setenv("S3_ENDPOINT", mockServer.URL)
		// S3_PUBLIC_ENDPOINT は意図的に未設定。
		t.Setenv("AWS_ACCESS_KEY_ID", "minioadmin")
		t.Setenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
		t.Setenv("S3_BUCKET", "test-bucket")
		t.Setenv("AWS_REGION", "ap-northeast-1")

		c, err := NewClientFromEnv()
		if err != nil {
			t.Fatalf("NewClientFromEnv() error = %v", err)
		}

		url, _, err := c.PresignGetObject(context.Background(), "test/file.pdf", "receipt.pdf", "application/pdf", time.Hour)
		if err != nil {
			t.Fatalf("PresignGetObject() error = %v", err)
		}

		// フォールバック: S3_PUBLIC_ENDPOINT 未設定時は S3_ENDPOINT が使われることを確認する。
		if !strings.Contains(url, mockServer.URL) {
			t.Errorf("PresignGetObject() URL = %q, want to contain %q (fallback to S3_ENDPOINT)", url, mockServer.URL)
		}
	})
}

// clearEnvVars は指定した環境変数をテスト開始時にクリアし、テスト終了時に元の値に戻す。
func clearEnvVars(t *testing.T, keys ...string) {
	t.Helper()
	for _, key := range keys {
		t.Setenv(key, "") // t.Setenv はテスト終了時に自動でリストアする。
	}
}
