package testutil

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// AssertStatus は記録されたレスポンスが期待する HTTP ステータスコードかを検証する。
func AssertStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Errorf("AssertStatus: got %d, want %d (body: %s)", rec.Code, want, rec.Body.String())
	}
}

// AssertErrorCode は JSON エラーレスポンスのボディに期待するコードが含まれているかを検証する。
// 期待するボディ形式: {"error": {"code": "...", "message": "..."}}
func AssertErrorCode(t *testing.T, rec *httptest.ResponseRecorder, wantCode string) {
	t.Helper()

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("AssertErrorCode: failed to parse JSON body: %v (body: %s)", err, rec.Body.String())
	}

	if body.Error.Code != wantCode {
		t.Errorf("AssertErrorCode: got code %q, want %q (body: %s)", body.Error.Code, wantCode, rec.Body.String())
	}
}

// ParseJSON は記録されたレスポンスボディを型 T の値にデコードする。
// デコードに失敗した場合はテストを失敗させる。
func ParseJSON[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()

	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("ParseJSON: failed to decode response body: %v (body: %s)", err, rec.Body.String())
	}
	return v
}
