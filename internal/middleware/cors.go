package middleware

import (
	"net/http"
	"strings"

	"github.com/go-chi/cors"
)

// Cors は指定された許可オリジンで設定された CORS middleware を返します。
// allowedOrigins はカンマ区切りのオリジン文字列です。
func Cors(allowedOrigins string) func(http.Handler) http.Handler {
	origins := splitTrimmed(allowedOrigins)
	if len(origins) == 0 {
		origins = []string{"http://localhost:5173"}
	}

	return cors.Handler(cors.Options{
		AllowedOrigins: origins,
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Authorization",
			"Content-Type",
			"X-Request-ID",
		},
		ExposedHeaders: []string{
			"X-Request-ID",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			"Retry-After",
		},
		AllowCredentials: true,
		MaxAge:           3600,
	})
}

// splitTrimmed は s をカンマで分割し、各要素の空白を除去します。
// 空文字列は結果から除外します。
func splitTrimmed(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
