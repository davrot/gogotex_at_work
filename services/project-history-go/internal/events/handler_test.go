package events

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/overleaf/project-history-go/internal/store"
)

func TestHandler_ListCreate(t *testing.T) {
	ms := store.NewMemStore()
	h := NewHandler(ms)
	mux := http.NewServeMux()
	h.Register(mux)

	// initially empty
	r := httptest.NewRequest(http.MethodGet, "/events", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var got []store.Event
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty list")
	}

	// create
	body := `{"project_id":"00000000-0000-0000-0000-000000000000","type":"test","payload":"p"}`
	r = httptest.NewRequest(http.MethodPost, "/events", strings.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var out store.Event
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected id to be set")
	}

	// list should include created event
	r = httptest.NewRequest(http.MethodGet, "/events", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 event, got %d", len(got))
	}
}
