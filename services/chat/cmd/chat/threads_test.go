package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestThreadsHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/project/abc123/threads", nil)
	w := httptest.NewRecorder()
	threadsHandler(w, req)

	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	var body []interface{}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("error decoding body: %v", err)
	}
}
