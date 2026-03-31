package middleware

import (
	"net/http"
	"strings"

	"github.com/go-chi/cors"
)

// Cors returns a CORS middleware configured with the given allowed origins.
// allowedOrigins is a comma-separated list of origin strings.
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

// splitTrimmed splits s by comma and trims whitespace from each element,
// discarding empty strings.
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
