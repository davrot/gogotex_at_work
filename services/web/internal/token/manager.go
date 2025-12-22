package token

import (
	"sync"
)

// TokenMeta is a minimal metadata representation stored for tokens.
type TokenMeta struct {
	Token   string
	UserID  string
	Active  bool
	Scopes  []string
}

// Manager is a tiny in-memory token manager used for unit tests and local parity.
type Manager struct {
	mu    sync.Mutex
	store map[string]TokenMeta // key by token string (plaintext for simplicity in tests)
}

// New returns a new Manager.
func New() *Manager {
	return &Manager{store: make(map[string]TokenMeta)}
}

// Create stores a token for a user.
func (m *Manager) Create(token string, userID string, scopes []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.store[token] = TokenMeta{Token: token, UserID: userID, Active: true, Scopes: scopes}
}

// Introspect returns metadata for a token if present.
func (m *Manager) Introspect(token string) (TokenMeta, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	meta, ok := m.store[token]
	return meta, ok
}

// Revoke marks a token inactive.
func (m *Manager) Revoke(token string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if meta, ok := m.store[token]; ok {
		meta.Active = false
		m.store[token] = meta
	}
}
