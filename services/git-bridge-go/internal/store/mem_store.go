package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// PushRecord is a minimal entity to record push events (id, repo, ref, author, timestamp)
type PushRecord struct {
	ID        string
	Repo      string
	Ref       string
	Author    string
	CreatedAt int64
}

// MemStore is an in-memory store for git-bridge used for tests and PoC.
type MemStore struct {
	mu    sync.RWMutex
	items map[string]PushRecord
}

func NewMemStore() *MemStore {
	return &MemStore{items: map[string]PushRecord{}}
}

func (m *MemStore) Create(ctx context.Context, r PushRecord) (PushRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	if r.CreatedAt == 0 {
		r.CreatedAt = time.Now().Unix()
	}
	m.items[r.ID] = r
	return r, nil
}

func (m *MemStore) List(ctx context.Context) ([]PushRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]PushRecord, 0, len(m.items))
	for _, v := range m.items {
		out = append(out, v)
	}
	return out, nil
}
