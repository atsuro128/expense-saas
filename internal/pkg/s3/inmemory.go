package s3

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"
)

// InMemoryClient はテスト用のインメモリ S3 モック実装。
// アップロードされたオブジェクトはメモリ上の map に保持される。
// 署名付き URL はダミー文字列を返す（実際の S3 へのアクセスは行わない）。
type InMemoryClient struct {
	mu              sync.Mutex
	objects         map[string][]byte // key -> ファイルバイト列
	LastDisposition string            // 最後に PresignGetObject に渡された disposition（テスト検証用）
}

// NewInMemoryClient はテスト用インメモリ S3 クライアントを生成する。
func NewInMemoryClient() *InMemoryClient {
	return &InMemoryClient{
		objects: make(map[string][]byte),
	}
}

// Upload はオブジェクトをインメモリ map に保存する。
func (c *InMemoryClient) Upload(_ context.Context, key string, data io.Reader, _ string) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("InMemoryClient.Upload: read: %w", err)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.objects[key] = body
	return nil
}

// PresignGetObject はダミーの署名付き URL を返す。
// disposition をクエリパラメータとして URL に含めることで、テストで disposition の内容を検証できる。
func (c *InMemoryClient) PresignGetObject(_ context.Context, key, fileName, _ string, disposition string, expiry time.Duration) (string, time.Time, error) {
	c.mu.Lock()
	c.LastDisposition = disposition
	c.mu.Unlock()

	expiresAt := time.Now().UTC().Add(expiry)
	// テスト用のダミー URL を返す（disposition をクエリパラメータに含める）。
	dummyURL := fmt.Sprintf("http://localhost:9000/test-bucket/%s?disposition=%s&filename=%s", key, disposition, fileName)
	return dummyURL, expiresAt, nil
}

// Delete はインメモリ map からオブジェクトを削除する。
// テストでは論理削除後の S3 物理削除は行わないため、この実装は呼ばれない想定。
func (c *InMemoryClient) Delete(_ context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.objects, key)
	return nil
}

// Has はキーが存在するかどうかを返す（テスト検証用）。
func (c *InMemoryClient) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.objects[key]
	return ok
}

// Get はキーのバイト列を返す（テスト検証用）。
func (c *InMemoryClient) Get(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.objects[key]
	return v, ok
}
