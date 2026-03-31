package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorResponse is the standard JSON error response body.
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody holds the error code, message, and optional validation details.
type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details []ValidationError `json:"details,omitempty"`
}

// ValidationError represents a single field-level validation failure.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// RespondJSON writes a JSON response with the given status code and data.
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// RespondError writes a structured JSON error response.
func RespondError(w http.ResponseWriter, status int, code, message string) {
	RespondJSON(w, status, ErrorResponse{
		Error: ErrorBody{
			Code:    code,
			Message: message,
		},
	})
}
