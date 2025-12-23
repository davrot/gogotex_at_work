package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemStore is a simple in-memory implementation of Store.
type MemStore struct {
	all []Document
	mu  sync.RWMutex
}

// NewMemStore returns an initialized MemStore.
func NewMemStore() *MemStore {
	return &MemStore{all: make([]Document, 0)}
}

// List returns a copy of all stored documents.
func (m *MemStore) List(ctx context.Context) ([]Document, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Document, len(m.all))
	copy(out, m.all)
	return out, nil
}

// Create stores a new document and returns it (with ID and CreatedAt populated).
func (m *MemStore) Create(ctx context.Context, d Document) (Document, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	if d.CreatedAt == 0 {
		d.CreatedAt = time.Now().Unix()
	}
	m.all = append(m.all, d)
	return d, nil
}
