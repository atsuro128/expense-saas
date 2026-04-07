package middleware

import (
	"errors"
	"net/http"
	"strings"

	gojwt "github.com/golang-jwt/jwt/v5"

	"expense-saas/internal/pkg/jwt"
)

// Auth は Authorization ヘッダーの Bearer JWT トークンを検証し、
// クレームをリクエストコンテキストに格納する middleware を返します。
func Auth(verifier *jwt.Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if verifier == nil {
				RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication not configured")
				return
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == "" {
				RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
				return
			}

			claims, err := verifier.Verify(tokenString)
			if err != nil {
				if errors.Is(err, gojwt.ErrTokenExpired) {
					RespondError(w, http.StatusUnauthorized, "TOKEN_EXPIRED", "Token has expired")
					return
				}
				RespondError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid token")
				return
			}

			ctx := r.Context()
			ctx = SetUserID(ctx, claims.UserID)
			ctx = SetTenantID(ctx, claims.TenantID)
			ctx = SetRole(ctx, claims.Role)

			// 認証情報を共有の RequestInfo 経由で Logger に逆伝播する。
			if info := GetRequestInfo(ctx); info != nil {
				info.UserID = claims.UserID
				info.TenantID = claims.TenantID
				info.Role = claims.Role
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
