package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorResponse は標準 JSON エラーレスポンスのボディです。
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody はエラーコード、メッセージ、およびオプションのバリデーション詳細を保持します。
type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details []ValidationError `json:"details,omitempty"`
}

// ValidationError はフィールドレベルの単一バリデーションエラーを表します。
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// RespondJSON は指定されたステータスコードとデータで JSON レスポンスを書き込みます。
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// RespondError は構造化された JSON エラーレスポンスを書き込みます。
func RespondError(w http.ResponseWriter, status int, code, message string) {
	RespondJSON(w, status, ErrorResponse{
		Error: ErrorBody{
			Code:    code,
			Message: message,
		},
	})
}
