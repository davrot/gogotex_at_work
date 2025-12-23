package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func TestResolveReopenDeleteDuplicateGenerate(t *testing.T) {
	s := store.New()
	// seed messages for thread t1
	m := []map[string]interface{}{{"_id": "m1", "content": "hello"}}
	b, _ := json.Marshal(m)
	s.Put("messages:abc:t1", string(b))

	// resolve
	req := httptest.NewRequest("POST", "/project/abc/threads/t1/resolve", nil)
	w := httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	if w.Result().StatusCode != 204 {
		t.Fatalf("expected 204 on resolve, got %d", w.Result().StatusCode)
	}

	// reopen
	req2 := httptest.NewRequest("POST", "/project/abc/threads/t1/reopen", nil)
	w2 := httptest.NewRecorder()
	threadsHandlerWithStore(s, w2, req2)
	if w2.Result().StatusCode != 204 {
		t.Fatalf("expected 204 on reopen, got %d", w2.Result().StatusCode)
	}

	// duplicate
	req3 := httptest.NewRequest("POST", "/project/abc/threads/duplicate", nil)
	w3 := httptest.NewRecorder()
	// attach body
	req3.Body = nopCloser{Reader: bytesFromString(`{"threads":["t1"]}`)}
	threadsHandlerWithStore(s, w3, req3)
	if w3.Result().StatusCode != 200 {
		t.Fatalf("expected 200 on duplicate, got %d", w3.Result().StatusCode)
	}

	// generate
	req4 := httptest.NewRequest("POST", "/project/abc/threads/generate", nil)
	w4 := httptest.NewRecorder()
	req4.Body = nopCloser{Reader: bytesFromString(`{"threads":["t1"]}`)}
	threadsHandlerWithStore(s, w4, req4)
	if w4.Result().StatusCode != 200 {
		t.Fatalf("expected 200 on generate, got %d", w4.Result().StatusCode)
	}
}

// minimal helpers to set Body in tests
type nopCloser struct{ Reader *string }

func (n nopCloser) Read(p []byte) (int, error) {
	copy(p, *n.Reader)
	return len(*n.Reader), nil
}

func (n nopCloser) Close() error { return nil }

func bytesFromString(s string) *string { return &s }
