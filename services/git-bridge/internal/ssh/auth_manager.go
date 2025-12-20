package ssh

// Placeholder for the SSH auth manager. This will implement fingerprint -> user lookup,
// introspection client and membership checks once the Go port progresses.

import "context"

type AuthManager struct {
	// TODO: add clients, caches and config
}

func NewAuthManager() *AuthManager {
	return &AuthManager{}
}

func (a *AuthManager) Close(ctx context.Context) error {
	// cleanup resources
	return nil
}
