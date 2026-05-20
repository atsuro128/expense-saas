package spa_test

import (
	"encoding/json"
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
//  1. /health → GET + HEAD ともにヘルスハンドラ経由（JSON レスポンス）
//  2. /api/auth/login → 200 OK（定義済み API ルートのダミー）
//  3. それ以外（/* および NotFound）→ SPA fallback ハンドラ
//
// http.ServeMux の最長プレフィックス一致に依存すると、本番の chi と挙動が異なり
// テストが偽 PASS になるため、必ず chi を使うこと。
func newTestRouter() http.Handler {
	r := chi.NewRouter()

	// /health は GET + HEAD の両メソッドでヘルスダミーハンドラを登録する（本番 main.go と同等）。
	// HEAD /health が SPA fallback に吸い込まれないよう明示登録する（issue #184 codex blocker）。
	// HEAD の場合はボディを書かない（RFC 9110 §9.3.2 に準拠した本番挙動を再現）。
	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		if r.Method != http.MethodHead {
			_, _ = w.Write([]byte(`{"status":"ok","checks":{"database":"ok"}}`))
		}
	}
	r.Get("/health", healthHandler)
	r.Head("/health", healthHandler)

	// 定義済み API ルート（本番と同様にフルパスで個別登録）。
	// ここに届いたリクエストはダミーの 200 OK を返す。
	r.Post("/api/auth/login", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"token":"dummy"}`))
	})

	// SPA fallback ハンドラを /* と NotFound に登録する（本番 main.go §11 と同等）。
	// GET と HEAD の両メソッドを登録する（issue #184）。
	spaHandler := spa.Handler(stubFS)
	r.Get("/*", spaHandler)
	r.Head("/*", spaHandler)
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

	// error.code が "RESOURCE_NOT_FOUND" であること（blocker-3 の回帰防止アサーション）。
	// 過去に "NOT_FOUND" という不一致値になっていた不具合を検知するために明示的に検証する。
	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(body), &errResp); err != nil {
		t.Errorf("failed to parse JSON error response: %v", err)
	} else {
		if errResp.Error.Code != "RESOURCE_NOT_FOUND" {
			t.Errorf("want error.code %q, got %q", "RESOURCE_NOT_FOUND", errResp.Error.Code)
		}
		if errResp.Error.Message != "Resource not found" {
			t.Errorf("want error.message %q, got %q", "Resource not found", errResp.Error.Message)
		}
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

// TestSPA_HEAD_Root は / への HEAD リクエストが 200・ボディなしで返ることを確認する（SPA-HEAD-001）。
// issue #184: r.Get("/*", ...) だけの登録では HEAD に 405 が返る問題の回帰防止。
func TestSPA_HEAD_Root(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodHead, "/", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, req)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("HEAD / want 200, got %d", resp.StatusCode)
	}

	// HEAD レスポンスはボディを含まないこと（RFC 9110 §9.3.2）。
	body := w.Body.String()
	if body != "" {
		t.Errorf("HEAD / want empty body, got %q", body)
	}

	// Content-Type ヘッダは返ること（ヘッダのみ返す）。
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		t.Error("HEAD / Content-Type header is empty")
	}
}

// TestSPA_HEAD_StaticAsset は静的アセットへの HEAD リクエストが 200・ボディなしで返ることを確認する（SPA-HEAD-002）。
// issue #184: /assets/foo.js への HEAD が 405 になる問題の回帰防止。
func TestSPA_HEAD_StaticAsset(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodHead, "/assets/foo.js", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, req)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("HEAD /assets/foo.js want 200, got %d", resp.StatusCode)
	}

	// HEAD レスポンスはボディを含まないこと。
	body := w.Body.String()
	if body != "" {
		t.Errorf("HEAD /assets/foo.js want empty body, got %q", body)
	}

	// Content-Type ヘッダは返ること（N-1: HEAD_Root / HEAD_SPARoute と粒度を統一）。
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		t.Error("HEAD /assets/foo.js Content-Type header is empty")
	}
	// 静的アセット（.js）は text/javascript または application/javascript を返すこと。
	if strings.Contains(ct, "text/html") {
		t.Errorf("HEAD /assets/foo.js want non-HTML Content-Type, got %q", ct)
	}
}

// TestSPA_HEAD_SPARoute は未定義の SPA ルートへの HEAD リクエストが 200 で index.html フォールバックすることを確認する（SPA-HEAD-003）。
// r.NotFound 経路を経由するパスも HEAD に対応していることを検証する。
func TestSPA_HEAD_SPARoute(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodHead, "/some/spa/route", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, req)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("HEAD /some/spa/route want 200, got %d", resp.StatusCode)
	}

	// HEAD レスポンスはボディを含まないこと。
	body := w.Body.String()
	if body != "" {
		t.Errorf("HEAD /some/spa/route want empty body, got %q", body)
	}

	// Content-Type ヘッダは返ること（index.html fallback のため text/html）。
	ct := resp.Header.Get("Content-Type")
	if !containsHTML(ct) {
		t.Errorf("HEAD /some/spa/route want Content-Type text/html, got %q", ct)
	}
}

// TestSPA_HEAD_Health は HEAD /health がヘルスハンドラ経由で JSON レスポンスを返すことを確認する（SPA-HEAD-004）。
// r.Head("/*") catch-all により HEAD /health が SPA fallback（index.html, text/html）に吸い込まれる
// false positive を防ぐ回帰テスト（issue #184 codex blocker 対応）。
func TestSPA_HEAD_Health(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodHead, "/health", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, req)

	resp := w.Result()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("HEAD /health want 200, got %d", resp.StatusCode)
	}

	// HEAD レスポンスはボディを含まないこと（RFC 9110 §9.3.2）。
	body := w.Body.String()
	if body != "" {
		t.Errorf("HEAD /health want empty body, got %q", body)
	}

	// Content-Type は text/html であってはならない（SPA fallback に吸い込まれていないこと）。
	ct := resp.Header.Get("Content-Type")
	if strings.Contains(ct, "text/html") {
		t.Errorf("HEAD /health want non-HTML Content-Type (health handler), got %q (SPA fallback occurred)", ct)
	}

	// GET /health と同じ Content-Type（application/json）を返すこと。
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("HEAD /health want Content-Type application/json (same as GET /health), got %q", ct)
	}
}

// TestSPA_HEAD_APINotFound は未定義の /api/* パスへの HEAD リクエストが JSON 404 を返すことを確認する（SPA-HEAD-005）。
// W-2: r.Head("/*") 追加後、HEAD /api/foo が誤って SPA fallback しないことを担保する回帰テスト。
func TestSPA_HEAD_APINotFound(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodHead, "/api/foo", nil)
	w := httptest.NewRecorder()

	newTestRouter().ServeHTTP(w, req)

	// 404 が返ること（SPA fallback して 200 を返していないこと）。
	if w.Code != http.StatusNotFound {
		t.Errorf("HEAD /api/foo want 404 from API handler, got %d", w.Code)
	}

	// Content-Type が JSON であること（index.html の text/html ではないこと）。
	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("HEAD /api/foo want Content-Type application/json, got %q", ct)
	}
}

// containsHTML は Content-Type ヘッダが text/html を含むかを判定する。
func containsHTML(ct string) bool {
	return len(ct) >= 9 && ct[:9] == "text/html"
}
