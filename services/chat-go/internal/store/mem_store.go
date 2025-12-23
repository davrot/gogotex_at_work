package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Message represents a chat message
type Message struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	Author    string `json:"author"`
	CreatedAt int64  `json:"created_at"`
}

// MemStore is an in-memory store for messages
type MemStore struct {
	mu    sync.RWMutex
	items map[string]Message
}

func NewMemStore() *MemStore {
	return &MemStore{items: map[string]Message{}}
}

func (m *MemStore) Create(ctx context.Context, msg Message) (Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if msg.ID == "" {
		msg.ID = uuid.NewString()
	}
	if msg.CreatedAt == 0 {
		msg.CreatedAt = time.Now().Unix()
	}
	m.items[msg.ID] = msg
	return msg, nil
}

func (m *MemStore) List(ctx context.Context) ([]Message, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Message, 0, len(m.items))
	for _, v := range m.items {
		out = append(out, v)
	}
	return out, nil
}
