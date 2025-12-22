package token

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
)

// TokenMeta is a minimal metadata representation stored for tokens.
type TokenMeta struct {
	HashPrefix string
	Algorithm  string
	UserID     string
	Active     bool
	Scopes     []string
}

// Manager is a tiny in-memory token manager used for unit tests and local parity.
type Manager struct {
	mu    sync.Mutex
	store map[string]TokenMeta // key by full sha256 hash hex
}

// New returns a new Manager.
func New() *Manager {
	return &Manager{store: make(map[string]TokenMeta)}
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// Create stores a token for a user; token is provided in plaintext and we store its hash.
func (m *Manager) Create(token string, userID string, scopes []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	hash := sha256Hex(token)
	m.store[hash] = TokenMeta{HashPrefix: hash[:8], Algorithm: "sha256", UserID: userID, Active: true, Scopes: scopes}
}

// Introspect returns metadata for a token if present.
func (m *Manager) Introspect(token string) (TokenMeta, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	hash := sha256Hex(token)
	meta, ok := m.store[hash]
	return meta, ok
}

// Revoke marks a token inactive.
func (m *Manager) Revoke(token string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	hash := sha256Hex(token)
	if meta, ok := m.store[hash]; ok {
		meta.Active = false
		m.store[hash] = meta
	}
}
