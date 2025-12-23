package messages

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/overleaf/real-time-go/internal/store"
)

func TestHandler_ListPublish(t *testing.T) {
	ms := store.NewMemStore()
	h := NewHandler(ms)
	mux := http.NewServeMux()
	h.Register(mux)

	// initially empty
	r := httptest.NewRequest(http.MethodGet, "/messages", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var got []store.Message
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty list")
	}

	// publish
	body := `{"channel":"chan1","body":"hello"}`
	r = httptest.NewRequest(http.MethodPost, "/messages", strings.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var out store.Message
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected id to be set")
	}

	// list should include created message
	r = httptest.NewRequest(http.MethodGet, "/messages", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 message, got %d", len(got))
	}
}
