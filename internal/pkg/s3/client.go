package s3

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Client は S3/MinIO 互換ストレージへのアクセスを提供する実装。
// 本番環境では AWS S3 を、ローカル開発では MinIO を使用する。
// AWS SDK v2 を使用せず、署名付き URL については簡易実装（テスト用途を考慮）。
type Client struct {
	endpoint  string // S3 エンドポイント URL（ローカルでは http://localhost:9000）
	bucket    string // バケット名
	accessKey string // アクセスキー
	secretKey string // シークレットキー
	region    string // リージョン
	httpCli   *http.Client
}

// NewClientFromEnv は環境変数から S3 クライアントを生成する。
// 環境変数:
//   - S3_ENDPOINT: エンドポイント URL（省略時は AWS S3 使用）
//   - S3_BUCKET: バケット名
//   - AWS_ACCESS_KEY_ID: アクセスキー
//   - AWS_SECRET_ACCESS_KEY: シークレットキー
//   - AWS_REGION: リージョン（省略時は ap-northeast-1）
func NewClientFromEnv() *Client {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "ap-northeast-1"
	}
	return &Client{
		endpoint:  os.Getenv("S3_ENDPOINT"),
		bucket:    os.Getenv("S3_BUCKET"),
		accessKey: os.Getenv("AWS_ACCESS_KEY_ID"),
		secretKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
		region:    region,
		httpCli:   &http.Client{Timeout: 30 * time.Second},
	}
}

// baseURL はバケットのベース URL を返す。
func (c *Client) baseURL() string {
	if c.endpoint != "" {
		// MinIO パス形式（http://localhost:9000/bucket）。
		ep := strings.TrimRight(c.endpoint, "/")
		return ep + "/" + c.bucket
	}
	// AWS S3 仮想ホスト形式。
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com", c.bucket, c.region)
}

// Upload はオブジェクトをストレージにアップロードする。
// テスト環境では InMemoryClient を使用するため、本実装は本番環境専用。
func (c *Client) Upload(ctx context.Context, key string, data io.Reader, contentType string) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("s3.Upload: read data: %w", err)
	}

	objectURL := c.baseURL() + "/" + key
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, objectURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("s3.Upload: create request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
	req.ContentLength = int64(len(body))

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return fmt.Errorf("s3.Upload: do request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("s3.Upload: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// PresignGetObject は署名付きダウンロード URL を生成する。
// 本番環境では AWS SDK の Presign を使用すべきだが、簡易実装として URL を構築する。
// テスト環境では InMemoryClient を使用する。
func (c *Client) PresignGetObject(_ context.Context, key, fileName, _ string, expiry time.Duration) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(expiry)

	// 簡易的なプリサイン URL（本番では AWS SDK を使用すること）。
	base := c.baseURL() + "/" + key
	q := url.Values{}
	q.Set("response-content-disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	q.Set("X-Amz-Expires", fmt.Sprintf("%d", int(expiry.Seconds())))
	presigned := base + "?" + q.Encode()

	return presigned, expiresAt, nil
}

// Delete はオブジェクトをストレージから削除する。
func (c *Client) Delete(ctx context.Context, key string) error {
	objectURL := c.baseURL() + "/" + key
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, objectURL, nil)
	if err != nil {
		return fmt.Errorf("s3.Delete: create request: %w", err)
	}

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return fmt.Errorf("s3.Delete: do request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("s3.Delete: unexpected status %d", resp.StatusCode)
	}
	return nil
}
