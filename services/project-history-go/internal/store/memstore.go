package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemStore is an in-memory store used for PoC and tests.
type MemStore struct {
	mu     sync.Mutex
	events []Event
}

// NewMemStore creates a new in-memory store.
func NewMemStore() *MemStore { return &MemStore{} }

func (m *MemStore) List(_ context.Context) ([]Event, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Event, len(m.events))
	copy(out, m.events)
	return out, nil
}

func (m *MemStore) Create(_ context.Context, e Event) (Event, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.CreatedAt == 0 {
		e.CreatedAt = time.Now().Unix()
	}
	m.events = append(m.events, e)
	return e, nil
}
