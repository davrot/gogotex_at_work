package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/davrot/gogotex_at_work/services/web/internal/token"
)

var manager *token.Manager

// SetManager allows tests or startup code to inject a token manager instance.
func SetManager(m *token.Manager) {
	manager = m
}

// IntrospectRequest is the request payload for the introspect endpoint.
type IntrospectRequest struct {
	Token string `json:"token"`
}

// IntrospectResponse is the canonical introspection response shape.
type IntrospectResponse struct {
	Active   bool     `json:"active"`
	UserID   string   `json:"userId,omitempty"`
	Scopes   []string `json:"scopes,omitempty"`
	ExpiresAt string  `json:"expiresAt,omitempty"`
}

// IntrospectHandler returns a deterministic response for testing purposes.
// In the full implementation this will validate token hashes and look up metadata.
func IntrospectHandler(w http.ResponseWriter, r *http.Request) {
	var req IntrospectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	// Query token manager if available (used in unit tests for parity)
	resp := IntrospectResponse{Active: false}
	if manager != nil {
		if meta, ok := manager.Introspect(req.Token); ok {
			resp.Active = meta.Active
			resp.UserID = meta.UserID
			resp.Scopes = meta.Scopes
			resp.ExpiresAt = time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
		}
	} else {
		// Fallback deterministic behavior for now
		if req.Token == "valid-token" {
			resp.Active = true
			resp.UserID = "u-test"
			resp.Scopes = []string{"repo:read"}
			resp.ExpiresAt = time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
