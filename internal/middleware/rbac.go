package middleware

import (
	"net/http"
)

// RequireRole は Auth middleware がコンテキストにセットしたロールが
// allowedRoles に含まれるリクエストのみ通過させる middleware を返します。
// ロールが存在しないか許可リストにない場合は 403 FORBIDDEN を返します。
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
