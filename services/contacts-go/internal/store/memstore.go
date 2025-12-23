// Package store provides simple storage abstractions for the PoC.
package store

import (
	"context"
	"sync"

	"github.com/google/uuid"
)

// MemStore is a simple in-memory store for PoC
type MemStore struct {
	mu       sync.Mutex
	contacts []Contact
}

// NewMemStore creates a new in-memory store.
func NewMemStore() *MemStore { return &MemStore{} }

// List returns all stored contacts.
func (m *MemStore) List(_ context.Context) ([]Contact, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Contact, len(m.contacts))
	copy(out, m.contacts)
	return out, nil
}

// Create stores the provided contact, assigning a new ID if missing, and returns it.
func (m *MemStore) Create(_ context.Context, c Contact) (Contact, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	m.contacts = append(m.contacts, c)
	return c, nil
}
