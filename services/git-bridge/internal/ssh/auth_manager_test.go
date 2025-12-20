package ssh

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestNewAuthManager(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer h.Close()

	os.Setenv("SSH_LOOKUP_BASE_URL", h.URL)
	am, err := NewAuthManagerFromEnv(h.Client())
	if err != nil {
		t.Fatalf("NewAuthManagerFromEnv error: %v", err)
	}
	if am == nil {
		t.Fatalf("NewAuthManager returned nil")
	}
	if err := am.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}
}
