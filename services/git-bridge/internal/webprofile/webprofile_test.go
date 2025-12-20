package webprofile

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIntrospectTokenOK(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"active":true,"userId":"u-99"}`))
	}))
	defer h.Close()

	user, active, err := IntrospectToken(h.Client(), h.URL, "tok")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !active || user != "u-99" {
		t.Fatalf("unexpected response: %v %v", user, active)
	}
}

func TestIntrospectTokenBadStatus(t *testing.T) {
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer h.Close()

	_, _, err := IntrospectToken(h.Client(), h.URL, "tok")
	if err == nil {
		t.Fatalf("expected error for bad status")
	}
}
