package middleware

import (
	"net/http"
)

// RequireRole returns a middleware that allows only requests whose role
// (stored in the context by the Auth middleware) is in allowedRoles.
// If the role is absent or not in the list, a 403 FORBIDDEN response is returned.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedRoles))
	for _, r := range allowedRoles {
		allowed[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetRole(r.Context())
			if _, ok := allowed[role]; !ok {
				RespondError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
