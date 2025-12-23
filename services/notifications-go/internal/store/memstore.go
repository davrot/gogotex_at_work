package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemStore is an in-memory store for PoC and tests.
type MemStore struct {
	mu     sync.Mutex
	notifs []Notification
}

func NewMemStore() *MemStore { return &MemStore{} }

func (m *MemStore) List(_ context.Context) ([]Notification, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Notification, len(m.notifs))
	copy(out, m.notifs)
	return out, nil
}

func (m *MemStore) Create(_ context.Context, n Notification) (Notification, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	if n.CreatedAt == 0 {
		n.CreatedAt = time.Now().Unix()
	}
	if n.Status == "" {
		n.Status = "queued"
	}
	m.notifs = append(m.notifs, n)
	return n, nil
}
