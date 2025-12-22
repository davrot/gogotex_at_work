package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func TestThreadsHandlerWithSeed(t *testing.T) {
	s := store.New()
	threads := []string{"t1", "t2"}
	b, _ := json.Marshal(threads)
	s.Put("threads:abc", string(b))

	req := httptest.NewRequest("GET", "/project/abc/threads", nil)
	w := httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)

	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	var body []interface{}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("error decoding body: %v", err)
	}
	if len(body) != len(threads) {
		t.Fatalf("expected %d threads, got %d", len(threads), len(body))
	}
}
