package notifications

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/overleaf/notifications-go/internal/store"
)

func TestHandler_ListCreate(t *testing.T) {
	ms := store.NewMemStore()
	h := NewHandler(ms)
	mux := http.NewServeMux()
	h.Register(mux)

	// initially empty
	r := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var got []store.Notification
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty list")
	}

	// create
	body := `{"recipient":"me@example.com","message":"hello"}`
	r = httptest.NewRequest(http.MethodPost, "/notifications", strings.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var out store.Notification
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected id to be set")
	}

	// list should include created notification
	r = httptest.NewRequest(http.MethodGet, "/notifications", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(got))
	}
}
