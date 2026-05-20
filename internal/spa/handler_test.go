package spa_test

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"expense-saas/internal/spa"
)

// stubFS はテスト用のインメモリ FS。
// embed.FS の代わりに使用し、実際の frontend/dist ファイルへの依存を排除する。
var stubFS fs.FS = fstest.MapFS{
	"index.html": {
		Data: []byte(`<!DOCTYPE html><html><body>SPA</body></html>`),
	},
	"assets/foo.js": {
		Data: []byte(`console.log("hello")`),
	},
	"assets/style.css": {
		Data: []byte(`body { margin: 0; }`),
	},
}

// newTestRouter は spa.Handler をマウントしたテスト用ルータを返す。
// ルーティング順序は main.go と同じにする:
//  1. /api/* → API 側（404 を返すスタブ）
//  2. /health → 200 OK
//  3. その他 → SPA fallback
func newTestRouter() http.Handler {
	mux := http.NewServeMux()

	// /api/ プレフィックスは API ハンドラが優先する（スタブとして 404 を返す）。
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"code":"NOT_FOUND","message":"not found"}`, http.StatusNotFound)
	})

	// /health は常に 200 OK を返す。
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// それ以外は SPA fallback ハンドラに委譲する。
	mux.Handle("/", spa.Handler(stubFS))

	return mux
}

// TestSPA_Root は / にアクセスした場合に index.html が返ることを確認する（SPA-001）。
func TestSPA_Root(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		t.Error("Content-Type header is empty")
	}

	// Content-Type が text/html を含むことを確認する。
	if !containsHTML(ct) {
		t.Errorf("want Content-Type text/html, got %q", ct)
	}
}

// TestSPA_SPARoute は /some/spa/route のような SPA ルートに index.html が返ることを確認する（SPA-002）。
func TestSPA_SPARoute(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/some/spa/route", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if !containsHTML(ct) {
		t.Errorf("want Content-Type text/html, got %q", ct)
	}
}

// TestSPA_Health は /health が 200 OK を返すことを確認する（SPA-003）。
func TestSPA_Health(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}

// TestSPA_APINotFound は存在しない /api/* パスが API 側の 404 を返すことを確認する（SPA-004）。
// SPA fallback に fallthrough しないことが重要。
func TestSPA_APINotFound(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/api/foo", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("want 404 from API handler, got %d", w.Code)
	}
}

// TestSPA_StaticAssetNotFound は存在しない .js ファイルへのアクセスが 404 になることを確認する（SPA-005）。
// JS ファイルは SPA fallback の対象外であることが重要。
func TestSPA_StaticAssetNotFound(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/assets/nonexistent.js", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("want 404 for missing static asset, got %d", w.Code)
	}
}

// TestSPA_StaticAssetExists は存在する .js ファイルが正常に返ることを確認する（SPA-006）。
func TestSPA_StaticAssetExists(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/assets/foo.js", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}

// containsHTML は Content-Type ヘッダが text/html を含むかを判定する。
func containsHTML(ct string) bool {
	return len(ct) >= 9 && ct[:9] == "text/html"
}
