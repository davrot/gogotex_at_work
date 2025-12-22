package main

import (
	"encoding/json"
	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestThreadsHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/project/abc123/threads", nil)
	w := httptest.NewRecorder()
	s := store.New()
	threadsHandlerWithStore(s, w, req)

	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	var body []interface{}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("error decoding body: %v", err)
	}
}
