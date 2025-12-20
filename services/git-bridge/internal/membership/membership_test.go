package membership

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsMemberTrue(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"member": true})
	}))
	defer h.Close()
	ok, err := IsMember(h.Client(), h.URL, "proj-1", "u-1")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !ok {
		t.Fatalf("expected true membership")
	}
}

func TestIsMemberFalse(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer h.Close()
	ok, err := IsMember(h.Client(), h.URL, "proj-1", "u-1")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if ok {
		t.Fatalf("expected false membership")
	}
}
