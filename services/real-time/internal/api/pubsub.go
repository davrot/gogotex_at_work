package api

import (
	"encoding/json"
	"net/http"
)

// PublishRequest represents a simple publish payload.
type PublishRequest struct {
	Topic string `json:"topic"`
	Msg   string `json:"msg"`
}

// PublishHandler is a minimal handler that accepts a publish request and returns
// a simple acknowledge response. This stub supports parity tests and basic
// contract validation while the full real-time transport is implemented.
func PublishHandler(w http.ResponseWriter, r *http.Request) {
	var req PublishRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Topic == "" {
		http.Error(w, "topic required", http.StatusBadRequest)
		return
	}
	resp := map[string]any{"ok": true, "topic": req.Topic}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
