package middleware

import (
	"net/http"

	"github.com/google/uuid"
)

const headerRequestID = "X-Request-ID"

// RequestID はリクエスト ID を読み取るか生成し、コンテキストに格納したうえで
// レスポンスヘッダーにセットする middleware です。
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(headerRequestID)
		if id == "" {
			id = uuid.New().String()
		}

		ctx := SetRequestID(r.Context(), id)
		w.Header().Set(headerRequestID, id)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
