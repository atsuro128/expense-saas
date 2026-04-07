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
// next.ServeHTTP を呼び出す前にコンテキストへ *RequestInfo を格納します。
// 下流の middleware（Auth、TenantContext）がこの構造体にユーザー・テナント情報を書き込むことで、
// ServeHTTP 返却後のログエントリにそれらの値が含まれるようになります。
func Logger(next http.Handler) http.Handler {
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
			slog.String("remote_ip", remoteIP(r)),
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

// remoteIP はリクエストからクライアント IP アドレスを取得します。
// X-Forwarded-For の先頭値を優先し、存在しない場合は RemoteAddr にフォールバックします。
func remoteIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.SplitN(xff, ",", 2)
		return strings.TrimSpace(parts[0])
	}

	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
