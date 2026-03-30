package middleware

import (
	"net/http"
	"strings"
)

// SecurityHeaders returns a middleware that sets security-related HTTP response headers
// on every response to mitigate common web vulnerabilities.
// For /api/ prefixed paths, Cache-Control: no-store is also set to prevent
// sensitive API responses from being cached.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-XSS-Protection", "0")
		h.Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: https://*.amazonaws.com; "+
				"connect-src 'self'; "+
				"font-src 'self'; "+
				"object-src 'none'; "+
				"frame-ancestors 'none'; "+
				"base-uri 'self'; "+
				"form-action 'self'",
		)
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		if strings.HasPrefix(r.URL.Path, "/api/") {
			h.Set("Cache-Control", "no-store")
		}

		next.ServeHTTP(w, r)
	})
}
