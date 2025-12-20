package lookup

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLookupFingerprintOK(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"userId": "u-123"})
	}))
	defer h.Close()
	client := h.Client()
	user, err := LookupFingerprint(client, h.URL, "SHA256:AAA")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if user != "u-123" {
		t.Fatalf("unexpected user: %s", user)
	}
}

func TestLookupFingerprintNotFound(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer h.Close()
	client := h.Client()
	user, err := LookupFingerprint(client, h.URL, "SHA256:AAA")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if user != "" {
		t.Fatalf("expected empty user, got: %s", user)
	}
}

func TestLookupFingerprintMalformed(t *testing.T) {
	_, err := LookupFingerprint(&http.Client{}, "http://example.local", "BAD")
	if err == nil {
		t.Fatalf("expected error for malformed fingerprint")
	}
}
