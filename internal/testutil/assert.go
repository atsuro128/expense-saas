package testutil

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// AssertStatus checks that the recorded response has the expected HTTP status code.
func AssertStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Errorf("AssertStatus: got %d, want %d (body: %s)", rec.Code, want, rec.Body.String())
	}
}

// AssertErrorCode checks that the JSON error response body contains the expected code.
// Expected body shape: {"error": {"code": "...", "message": "..."}}
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

// ParseJSON decodes the recorded response body into a value of type T.
// The test fails if decoding fails.
func ParseJSON[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()

	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("ParseJSON: failed to decode response body: %v (body: %s)", err, rec.Body.String())
	}
	return v
}
