package spa_test

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/go-chi/chi/v5"

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

// newTestRouter は spa.Handler をマウントしたテスト用の chi ルータを返す。
// 本番（main.go）と同等の chi ルーティング構成を再現し、挙動を正確に検証する:
//  1. /health → 200 OK（ダミー）
//  2. /api/auth/login → 200 OK（定義済み API ルートのダミー）
//  3. それ以外（/* および NotFound）→ SPA fallback ハンドラ
//
// http.ServeMux の最長プレフィックス一致に依存すると、本番の chi と挙動が異なり
// テストが偽 PASS になるため、必ず chi を使うこと。
func newTestRouter() http.Handler {
	r := chi.NewRouter()

	// /health は常に 200 OK を返す（本番と同等）。
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// 定義済み API ルート（本番と同様にフルパスで個別登録）。
	// ここに届いたリクエストはダミーの 200 OK を返す。
	r.Post("/api/auth/login", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"token":"dummy"}`))
	})

	// SPA fallback ハンドラを /* と NotFound に登録する（本番 main.go §11 と同等）。
	spaHandler := spa.Handler(stubFS)
	r.Get("/*", spaHandler)
	r.NotFound(spaHandler)

	return r
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

// TestSPA_APINotFound は未定義の /api/* パスが JSON 404 を返すことを確認する（SPA-004）。
// chi では /api/foo に対応するルートが存在しないため SPA fallback ハンドラに到達する。
// SPA fallback ハンドラが /api/ プレフィックスを検出して JSON 404 を返すことを検証する。
func TestSPA_APINotFound(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/api/foo", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	// 404 が返ること。
	if w.Code != http.StatusNotFound {
		t.Errorf("want 404 from API handler, got %d", w.Code)
	}

	// Content-Type が JSON であること（index.html の text/html ではないこと）。
	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("want Content-Type application/json, got %q", ct)
	}

	// ボディが index.html でないこと（HTML を返していないこと）。
	body := w.Body.String()
	if strings.Contains(body, "<!DOCTYPE html>") {
		t.Error("want JSON 404, got HTML (SPA fallback should not happen for /api/ paths)")
	}
}

// TestSPA_DefinedAPIRoute は定義済みの /api/auth/login が API ダミーハンドラに届くことを確認する（SPA-005）。
func TestSPA_DefinedAPIRoute(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("want 200 from defined API handler, got %d", w.Code)
	}

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("want Content-Type application/json, got %q", ct)
	}
}

// TestSPA_StaticAssetNotFound は存在しない .js ファイルへのアクセスが 404 になることを確認する（SPA-006）。
// JS ファイルは SPA fallback の対象外であることが重要。
func TestSPA_StaticAssetNotFound(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/assets/nonexistent.js", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("want 404 for missing static asset, got %d", w.Code)
	}

	// 静的アセット不在の 404 は HTML を返さないこと。
	body := w.Body.String()
	if strings.Contains(body, "<!DOCTYPE html>") {
		t.Error("want plain 404, got HTML (SPA fallback should not happen for extension paths)")
	}
}

// TestSPA_StaticAssetExists は存在する .js ファイルが正常に返ることを確認する（SPA-007）。
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
