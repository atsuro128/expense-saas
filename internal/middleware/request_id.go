package middleware

import (
	"net/http"

	"github.com/google/uuid"
)

const headerRequestID = "X-Request-ID"

// RequestID is a middleware that reads or generates a request ID,
// stores it in the context, and sets it on the response header.
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
