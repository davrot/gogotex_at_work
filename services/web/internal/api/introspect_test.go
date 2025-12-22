package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIntrospectHandler_Valid(t *testing.T) {
	// Ensure manager is not set for fallback behavior
	SetManager(nil)
	body := bytes.NewBufferString(`{"token":"valid-token"}`)
	req := httptest.NewRequest("POST", "/internal/api/tokens/introspect", body)
	r := httptest.NewRecorder()
	IntrospectHandler(r, req)
	if r.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", r.Code)
	}
	var resp IntrospectResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if !resp.Active || resp.UserID == "" {
		t.Fatalf("expected active introspection, got %+v", resp)
	}
}

func TestIntrospectHandler_InvalidJSON(t *testing.T) {
	body := bytes.NewBufferString(`{invalid`)
	req := httptest.NewRequest("POST", "/internal/api/tokens/introspect", body)
	r := httptest.NewRecorder()
	IntrospectHandler(r, req)
	if r.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", r.Code)
	}
}

func TestIntrospectHandler_Inactive(t *testing.T) {
	body := bytes.NewBufferString(`{"token":"nope"}`)
	req := httptest.NewRequest("POST", "/internal/api/tokens/introspect", body)
	r := httptest.NewRecorder()
	IntrospectHandler(r, req)
	if r.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", r.Code)
	}
	var resp IntrospectResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Active {
		t.Fatalf("expected inactive introspection, got %+v", resp)
	}
}
