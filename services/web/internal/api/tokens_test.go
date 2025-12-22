package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateTokenHandler_OK(t *testing.T) {
	body := bytes.NewBufferString(`{"userId":"u-1","label":"dev"}`)
	req := httptest.NewRequest("POST", "/internal/api/users/u-1/git-tokens", body)
	r := httptest.NewRecorder()
	CreateTokenHandler(r, req)
	if r.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", r.Code)
	}
	var resp CreateTokenResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.AccessToken == "" || resp.AccessTokenPartial == "" {
		t.Fatalf("expected token values, got %+v", resp)
	}
}

func TestCreateTokenHandler_BadJSON(t *testing.T) {
	body := bytes.NewBufferString(`{invalid`)
	req := httptest.NewRequest("POST", "/internal/api/users/u-1/git-tokens", body)
	r := httptest.NewRecorder()
	CreateTokenHandler(r, req)
	if r.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", r.Code)
	}
}
