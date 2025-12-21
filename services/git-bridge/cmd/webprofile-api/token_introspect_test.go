package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTokenIntrospect_InvalidFormat(t *testing.T) {
	// Prepare request with malformed token (non-hex chars)
	body := bytes.NewBufferString(`{"token":"invalid-token"}`)
	req, err := http.NewRequest("POST", "/internal/api/tokens/introspect", body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	rr := httptest.NewRecorder()

	// Call handler directly with nil client (validation happens before DB access)
	tokenIntrospectHandler(context.Background(), rr, req, nil)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
	if rr.Body.Len() == 0 {
		t.Fatalf("expected non-empty body with error message")
	}
	var out map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("invalid json body: %v", err)
	}
	if out["message"] != "invalid token format" {
		t.Fatalf("unexpected message: %v", out)
	}
}
