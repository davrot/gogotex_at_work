package api

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"time"

	"github.com/davrot/gogotex_at_work/services/web/internal/token"
)

func tokenManager() *token.Manager {
	return tokenMgr
}

var tokenMgr *token.Manager

// SetTokenManager lets tests or startup code inject the manager
func SetTokenManager(m *token.Manager) {
	tokenMgr = m
}

// CreateTokenRequest stores token create request fields.
type CreateTokenRequest struct {
	UserID  string `json:"userId"`
	Label   string `json:"label,omitempty"`
	Expires string `json:"expiresAt,omitempty"`
}

// CreateTokenResponse is the minimal response for token creation.
type CreateTokenResponse struct {
	ID                 string `json:"id"`
	AccessToken        string `json:"accessToken"` // plaintext token (shown once)
	AccessTokenPartial string `json:"accessTokenPartial"`
}

// CreateTokenHandler returns a deterministic token for testing purposes.
func CreateTokenHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	// Simple deterministic token material for tests
	token := randomToken()
	resp := CreateTokenResponse{
		ID:                 "tok-" + token[:8],
		AccessToken:        token,
		AccessTokenPartial: token[:8],
	}

	// Register in token manager if present
	if tm := tokenManager(); tm != nil {
		tm.Create(token, req.UserID, []string{"repo:read"})
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func randomToken() string {
	rand.Seed(time.Now().UnixNano())
	letters := []rune("abcdefghijklmnopqrstuvwxyz0123456789")
	s := make([]rune, 40)
	for i := range s {
		s[i] = letters[rand.Intn(len(letters))]
	}
	return string(s)
}
