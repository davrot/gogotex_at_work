package api

import (
	"encoding/json"
	"net/http"
	"time"
)

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

	// Simple deterministic behavior for now: token 'valid-token' -> active true
	resp := IntrospectResponse{Active: false}
	if req.Token == "valid-token" {
		resp.Active = true
		resp.UserID = "u-test"
		resp.Scopes = []string{"repo:read"}
		resp.ExpiresAt = time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
