package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"strings"
	"time"

	"github.com/davrot/gogotex_at_work/services/web/internal/token"
)

func TestCreateThenIntrospect_RoundTrip(t *testing.T) {
	// inject in-memory token manager
	m := token.New()
	SetTokenManager(m)
	SetManager(m)
	defer func() {
		SetTokenManager(nil)
		SetManager(nil)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/internal/api/users/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !strings.HasSuffix(r.URL.Path, "/git-tokens") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		CreateTokenHandler(w, r)
	})
	mux.HandleFunc("/internal/api/tokens/introspect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		IntrospectHandler(w, r)
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	// Create token
	createReq := map[string]string{"userId": "u-1", "label": "itest"}
	b, _ := json.Marshal(createReq)
	resp, err := http.Post(srv.URL+"/internal/api/users/u-1/git-tokens", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("create request failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	var cr CreateTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if cr.AccessToken == "" {
		t.Fatalf("expected access token, got %+v", cr)
	}

	// allow a tiny window for manager to be populated
	time.Sleep(10 * time.Millisecond)

	// Introspect
	intReq := map[string]string{"token": cr.AccessToken}
	b2, _ := json.Marshal(intReq)
	resp2, err := http.Post(srv.URL+"/internal/api/tokens/introspect", "application/json", bytes.NewReader(b2))
	if err != nil {
		t.Fatalf("introspect request failed: %v", err)
	}
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on introspect, got %d", resp2.StatusCode)
	}
	var ir IntrospectResponse
	if err := json.NewDecoder(resp2.Body).Decode(&ir); err != nil {
		t.Fatalf("decode introspect response: %v", err)
	}
	if !ir.Active || ir.UserID != "u-1" {
		t.Fatalf("unexpected introspect result: %+v", ir)
	}
}
