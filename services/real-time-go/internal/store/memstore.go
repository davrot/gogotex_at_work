package store

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemStore is an in-memory store for messages.
type MemStore struct {
	mu       sync.Mutex
	messages []Message
}

func NewMemStore() *MemStore { return &MemStore{} }

func (m *MemStore) List(_ context.Context) ([]Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Message, len(m.messages))
	copy(out, m.messages)
	return out, nil
}

func (m *MemStore) Publish(_ context.Context, msg Message) (Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if msg.ID == "" {
		msg.ID = uuid.NewString()
	}
	if msg.CreatedAt == 0 {
		msg.CreatedAt = time.Now().Unix()
	}
	m.messages = append(m.messages, msg)
	return msg, nil
}
