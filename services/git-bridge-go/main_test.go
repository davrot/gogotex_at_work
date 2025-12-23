package main

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	res := w.Result()
	if res.StatusCode != 200 {
		t.Fatalf("expected 200 got %d", res.StatusCode)
	}
	b, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(b), "status") {
		t.Fatalf("body missing status: %s", string(b))
	}
}
