package middleware

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// responseWriter は書き込まれたステータスコードを記録するための http.ResponseWriter ラッパーです。
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Unwrap は内部の http.ResponseWriter を返します。
func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}

// Logger はリクエストごとに構造化アクセスログを出力する middleware を返します。
// /health へのリクエストはログ出力をスキップします。
//
// trustedProxyCount は信頼するプロキシ段数（TRUSTED_PROXY_COUNT 環境変数由来）。
// remoteIP の解釈方法を制御する（詳細は remoteIP の godoc 参照）。
//
// next.ServeHTTP を呼び出す前にコンテキストへ *RequestInfo を格納します。
// 下流の middleware（Auth、TenantContext）がこの構造体にユーザー・テナント情報を書き込むことで、
// ServeHTTP 返却後のログエントリにそれらの値が含まれるようになります。
func Logger(trustedProxyCount int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// 下流の middleware が認証コンテキスト値を Logger へ逆伝播できるよう、
			// ミュータブルな RequestInfo を注入する。
			info := &RequestInfo{}
			ctx := context.WithValue(r.Context(), requestInfoKey, info)
			r = r.WithContext(ctx)

			start := time.Now()
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start).Milliseconds()

			attrs := []slog.Attr{
				slog.String("request_id", GetRequestID(ctx)),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", wrapped.status),
				slog.Int64("duration_ms", duration),
				slog.String("user_agent", r.UserAgent()),
				slog.String("remote_ip", remoteIP(r, trustedProxyCount)),
			}

			// info は ServeHTTP 返却後に Auth / TenantContext によって書き込まれる。
			if info.TenantID != "" {
				attrs = append(attrs, slog.String("tenant_id", info.TenantID))
			}
			if info.UserID != "" {
				attrs = append(attrs, slog.String("user_id", info.UserID))
			}

			args := make([]any, len(attrs))
			for i, a := range attrs {
				args[i] = a
			}

			switch {
			case wrapped.status >= 500:
				slog.Error("request completed", args...)
			case wrapped.status >= 400:
				slog.Warn("request completed", args...)
			default:
				slog.Info("request completed", args...)
			}
		})
	}
}

// remoteAddr は RemoteAddr からホスト部を抽出して返す。
// SplitHostPort に失敗した場合（ポートなし形式等）は RemoteAddr 全体を返す。
func remoteAddr(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// remoteIP は TRUSTED_PROXY_COUNT 方式でリクエストからクライアント IP アドレスを取得します。
//
// n = trustedProxyCount、parts = XFF ヘッダをカンマ分割・trim・空要素除外した配列:
//  1. n == 0（dev）: XFF を完全無視し RemoteAddr を採用。
//  2. len(parts) < n: XFF を信用せず RemoteAddr にフォールバック。
//  3. len(parts) >= n（n >= 1）: parts[len(parts)-n] を実クライアント IP として採用。
//  4. XFF ヘッダ不在、または有効要素数が 0: RemoteAddr を採用。
func remoteIP(r *http.Request, n int) string {
	// 規則 1: n==0（dev 環境）は XFF を完全無視。
	if n == 0 {
		return remoteAddr(r)
	}

	// XFF ヘッダをカンマ分割し、trim・空要素除外した有効要素リストを構築する。
	xff := r.Header.Get("X-Forwarded-For")
	var parts []string
	if xff != "" {
		for _, p := range strings.Split(xff, ",") {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				parts = append(parts, trimmed)
			}
		}
	}

	// 規則 4: XFF 不在または有効要素 0。
	if len(parts) == 0 {
		return remoteAddr(r)
	}

	// 規則 2: 有効要素数がプロキシ段数より少ない場合は詐称と判断してフォールバック。
	if len(parts) < n {
		return remoteAddr(r)
	}

	// 規則 3: parts[len-n] が実クライアント IP。
	return parts[len(parts)-n]
}
