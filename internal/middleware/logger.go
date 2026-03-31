package middleware

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// responseWriter wraps http.ResponseWriter to capture the written status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Unwrap returns the underlying http.ResponseWriter.
func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}

// Logger returns a middleware that writes a structured access log entry for each request.
// Requests to /health are silently skipped.
//
// A *RequestInfo is stored in context before calling next.ServeHTTP. Downstream
// middleware (Auth, TenantContext) write user/tenant data into this struct so that
// the log entry recorded after ServeHTTP returns includes those values.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Inject a mutable RequestInfo so downstream middleware can back-propagate
		// auth context values to the logger.
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

		// info is populated by Auth/TenantContext after ServeHTTP returns.
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

// remoteIP extracts the client IP address from the request.
// It prefers the leftmost value of X-Forwarded-For, falling back to RemoteAddr.
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
