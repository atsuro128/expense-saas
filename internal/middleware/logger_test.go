package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// makeReq は RemoteAddr と X-Forwarded-For を設定した *http.Request を組み立てるヘルパー。
func makeReq(remoteAddrVal, xff string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = remoteAddrVal
	if xff != "" {
		r.Header.Set("X-Forwarded-For", xff)
	}
	return r
}

// TestRemoteIP_Count0_IgnoresXFF は count=0（dev）のとき XFF を無視して RemoteAddr を返すことを検証する。
func TestRemoteIP_Count0_IgnoresXFF(t *testing.T) {
	r := makeReq("192.0.2.1:1234", "10.0.0.1, 10.0.0.2")
	got := remoteIP(r, 0)
	if got != "192.0.2.1" {
		t.Errorf("count=0: 複数要素 XFF があっても RemoteAddr を返す期待値 192.0.2.1、got %q", got)
	}
}

// TestRemoteIP_Count0_NoXFF は count=0 かつ XFF 不在のとき RemoteAddr を返すことを検証する。
func TestRemoteIP_Count0_NoXFF(t *testing.T) {
	r := makeReq("192.0.2.5:80", "")
	got := remoteIP(r, 0)
	if got != "192.0.2.5" {
		t.Errorf("count=0 XFF なし: 期待値 192.0.2.5、got %q", got)
	}
}

// TestRemoteIP_InsufficientParts は len(parts) < count のとき RemoteAddr にフォールバックすることを検証する。
func TestRemoteIP_InsufficientParts(t *testing.T) {
	// count=2、XFF は 1 要素のみ → 要素数不足
	r := makeReq("192.0.2.10:9090", "10.0.0.1")
	got := remoteIP(r, 2)
	if got != "192.0.2.10" {
		t.Errorf("要素数不足 (1 < 2): RemoteAddr フォールバック期待値 192.0.2.10、got %q", got)
	}
}

// TestRemoteIP_ExactCount は len(parts) == count のとき parts[len-count] を返すことを検証する。
func TestRemoteIP_ExactCount(t *testing.T) {
	// count=2、XFF は 2 要素 → parts[2-2]=parts[0]="1.1.1.1" が実クライアント
	r := makeReq("192.0.2.20:443", "1.1.1.1, 10.0.0.1")
	got := remoteIP(r, 2)
	if got != "1.1.1.1" {
		t.Errorf("段数ちょうど (len=2, count=2): parts[0] 期待値 1.1.1.1、got %q", got)
	}
}

// TestRemoteIP_ExcessParts は len(parts) > count のとき詐称 XFF より右の要素を返し、左を参照しないことを検証する。
func TestRemoteIP_ExcessParts(t *testing.T) {
	// count=2、XFF は 3 要素。先頭 "attacker" は詐称値。
	// 期待: parts[3-2] = parts[1] = "2.2.2.2"
	r := makeReq("192.0.2.30:1111", "attacker, 2.2.2.2, 10.0.0.1")
	got := remoteIP(r, 2)
	if got != "2.2.2.2" {
		t.Errorf("段数超過 (len=3, count=2): parts[1] 期待値 2.2.2.2、got %q", got)
	}
}

// TestRemoteIP_NoXFF は XFF ヘッダ不在のとき RemoteAddr を返すことを検証する（count >= 1）。
func TestRemoteIP_NoXFF(t *testing.T) {
	r := makeReq("192.0.2.40:8080", "")
	got := remoteIP(r, 1)
	if got != "192.0.2.40" {
		t.Errorf("XFF 不在: RemoteAddr 期待値 192.0.2.40、got %q", got)
	}
}

// TestRemoteIP_EmptyXFFHeader は XFF が空値ヘッダのとき（"X-Forwarded-For: "）RemoteAddr にフォールバックすることを検証する。
func TestRemoteIP_EmptyXFFHeader(t *testing.T) {
	r := makeReq("192.0.2.50:7070", "")
	// 空値ヘッダを明示的にセット
	r.Header.Set("X-Forwarded-For", "   ")
	got := remoteIP(r, 1)
	if got != "192.0.2.50" {
		t.Errorf("XFF 空値ヘッダ: 有効要素 0 として RemoteAddr 期待値 192.0.2.50、got %q", got)
	}
}

// TestRemoteIP_SparseXFFElements は XFF にカンマ区切りで空要素が混在するとき有効要素のみカウントすることを検証する。
func TestRemoteIP_SparseXFFElements(t *testing.T) {
	// "X-Forwarded-For: ," → 空要素除外後に有効要素 0 → RemoteAddr フォールバック
	r := makeReq("192.0.2.60:6060", "")
	r.Header.Set("X-Forwarded-For", ",")
	got := remoteIP(r, 1)
	if got != "192.0.2.60" {
		t.Errorf("XFF カンマのみ: 有効要素 0 として RemoteAddr 期待値 192.0.2.60、got %q", got)
	}
}

// TestRemoteIP_RemoteAddrWithoutPort は RemoteAddr にポートがない形式でも正しく処理することを検証する。
func TestRemoteIP_RemoteAddrWithoutPort(t *testing.T) {
	r := makeReq("192.0.2.70", "")
	got := remoteIP(r, 0)
	// SplitHostPort は失敗するので RemoteAddr 全体を返す
	if got != "192.0.2.70" {
		t.Errorf("RemoteAddr ポートなし: 全体を返す期待値 192.0.2.70、got %q", got)
	}
}

// TestLogger_Integration は Logger ミドルウェアが正常に構築・動作することを検証するスモークテスト。
func TestLogger_Integration(t *testing.T) {
	called := false
	handler := Logger(0)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	r.RemoteAddr = "127.0.0.1:12345"
	handler.ServeHTTP(w, r)

	if !called {
		t.Error("Logger: 内部ハンドラが呼ばれなかった")
	}
}
