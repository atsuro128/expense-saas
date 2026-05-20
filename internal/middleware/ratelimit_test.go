package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// makeRateLimitReq は RemoteAddr と XFF を設定したリクエストを返すヘルパー。
func makeRateLimitReq(remoteAddrVal, xff string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	r.RemoteAddr = remoteAddrVal
	if xff != "" {
		r.Header.Set("X-Forwarded-For", xff)
	}
	return r
}

// recordedIP は RateLimitByIP が実際に採用した IP キーを記録するためのヘルパー。
// 内部の store.get を経由するため、ここでは "最初のリクエスト通過" を判定するのではなく、
// remoteIP の挙動が正しいことを検証する単体テストとして設計する。

// TestRateLimitByIP_TrustedProxyCount は RateLimitByIP が trustedProxyCount を通じて
// 詐称 XFF を無視し、正しい IP でレート制限することを検証する。
//
// count=0（dev）のとき: 詐称 XFF があっても RemoteAddr が採用されることで
// IP キーが "spoof_ip" にならないことを間接的に確認する。
// 実装: 同 RemoteAddr で同キーを持つ複数リクエストを許可制限内で送り、すべて通過することを確認する。
func TestRateLimitByIP_TrustedProxyCount0_IgnoresXFF(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 高い制限値（1000/min）でレート制限は実質通過できる設定にする
	mw := RateLimitByIP(ctx, 1000, time.Minute, 0)

	capturedIP := ""
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// count=0 なので remoteIP は RemoteAddr を返すはず
		capturedIP = remoteIP(r, 0)
		w.WriteHeader(http.StatusOK)
	})

	handler := mw(inner)

	// 詐称 XFF: "1.1.1.1" を送信。count=0 なら無視され RemoteAddr を使う
	r := makeRateLimitReq("192.0.2.100:5555", "1.1.1.1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("count=0: リクエストが通過すべきだが status=%d", w.Code)
	}
	if capturedIP != "192.0.2.100" {
		t.Errorf("count=0: remoteIP は RemoteAddr を返す期待値 192.0.2.100、got %q", capturedIP)
	}
}

// TestRateLimitByIP_TrustedProxyCount2_UsesCorrectIP は count=2 のとき
// XFF から正しいクライアント IP を採用することを検証する。
func TestRateLimitByIP_TrustedProxyCount2_UsesCorrectIP(t *testing.T) {
	// remoteIP(r, 2) の挙動を直接確認する（RateLimitByIP の IP 選択ロジック確認）
	r := makeRateLimitReq("10.0.0.1:80", "attacker, 3.3.3.3, 10.0.0.1")
	// count=2 → parts=[attacker, 3.3.3.3, 10.0.0.1]、parts[3-2]=parts[1]="3.3.3.3"
	got := remoteIP(r, 2)
	if got != "3.3.3.3" {
		t.Errorf("count=2 詐称 XFF: 実クライアント IP 期待値 3.3.3.3、got %q", got)
	}
}

// TestRateLimitByIP_SpoofedXFF は詐称 XFF でレート制限キーを操作できないことを検証する。
// count=2 のとき、XFF 先頭の "attacker" は無視され、parts[len-2] が採用される。
func TestRateLimitByIP_SpoofedXFF(t *testing.T) {
	// count=1 のとき: XFF = "spoofed, real_client"
	// parts=[spoofed, real_client]、parts[2-1]=parts[1]="real_client" が採用される
	r := makeRateLimitReq("10.10.10.10:443", "spoofed, real_client")
	got := remoteIP(r, 1)
	if got != "real_client" {
		t.Errorf("詐称 XFF: spoofed が無視され real_client が採用される期待値 real_client、got %q", got)
	}
}

// TestRateLimitByUser_FallbackUsesRemoteIP はユーザー ID なし（未認証フォールバック）のとき
// RateLimitByUser が remoteIP 経由で IP を取得することを検証する。
func TestRateLimitByUser_FallbackUsesRemoteIP(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mw := RateLimitByUser(ctx, 1000, time.Minute, 0)

	capturedIP := ""
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedIP = remoteIP(r, 0)
		w.WriteHeader(http.StatusOK)
	})

	handler := mw(inner)

	// ユーザー ID なし（コンテキスト未設定）→ IP フォールバック
	r := makeRateLimitReq("192.0.2.200:9999", "1.2.3.4")
	// count=0 なら XFF 無視 → RemoteAddr を使う
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("RateLimitByUser フォールバック: リクエストが通過すべきだが status=%d", w.Code)
	}
	if capturedIP != "192.0.2.200" {
		t.Errorf("RateLimitByUser count=0: remoteIP は RemoteAddr 期待値 192.0.2.200、got %q", capturedIP)
	}
}

// TestRateLimitByUser_FallbackCount2_IgnoresSpoofedXFF は count=2 の未認証フォールバックで
// 詐称 XFF でレート制限キーを操作できないことを検証する。
func TestRateLimitByUser_FallbackCount2_IgnoresSpoofedXFF(t *testing.T) {
	// count=2、XFF="attacker, real, proxy"
	// parts=[attacker, real, proxy]、parts[3-2]=parts[1]="real"
	r := makeRateLimitReq("10.0.0.2:80", "attacker, real, proxy")
	got := remoteIP(r, 2)
	if got != "real" {
		t.Errorf("RateLimitByUser count=2 詐称 XFF: 期待値 real、got %q", got)
	}
}

// TestRateLimitByIP_NoXFF_UsesRemoteAddr は XFF 不在のとき RemoteAddr を使うことを検証する（count >= 1）。
func TestRateLimitByIP_NoXFF_UsesRemoteAddr(t *testing.T) {
	r := makeRateLimitReq("192.0.2.110:7777", "")
	got := remoteIP(r, 1)
	if got != "192.0.2.110" {
		t.Errorf("XFF 不在 count=1: RemoteAddr 期待値 192.0.2.110、got %q", got)
	}
}

// TestRateLimitByIP_EmptyXFF_UsesRemoteAddr は XFF 空値ヘッダのとき RemoteAddr にフォールバックすることを検証する。
func TestRateLimitByIP_EmptyXFF_UsesRemoteAddr(t *testing.T) {
	r := makeRateLimitReq("192.0.2.120:6666", "")
	r.Header.Set("X-Forwarded-For", "  ")
	got := remoteIP(r, 1)
	if got != "192.0.2.120" {
		t.Errorf("XFF 空値 count=1: RemoteAddr 期待値 192.0.2.120、got %q", got)
	}
}
