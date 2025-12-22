package main

import (
	"encoding/json"
	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
	"net/http"
	"net/http/httptest"
	"testing"
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
	var body map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("error decoding body: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("expected empty object for seeded threads, got %+v", body)
	}
}
