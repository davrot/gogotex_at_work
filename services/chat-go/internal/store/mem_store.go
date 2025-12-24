package store

import (
	"context"
	"errors"
	"strings"
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
	RoomID    string `json:"room_id,omitempty"`
}

// Room represents a comment thread room
type Room struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	ThreadID  string `json:"thread_id"`
	Resolved  bool   `json:"resolved,omitempty"`
}

// MemStore is an in-memory store for messages and rooms
type MemStore struct {
	mu    sync.RWMutex
	items map[string]Message
	rooms map[string]Room
	// mapping from project -> list of thread ids
	projectThreads map[string][]string
}

func newHexID() string {
	// Use uuid without dashes and truncate to 24 chars to resemble ObjectId
	return strings.ReplaceAll(uuid.NewString(), "-", "")[0:24]
}

func NewMemStore() *MemStore {
	return &MemStore{items: map[string]Message{}, rooms: map[string]Room{}, projectThreads: map[string][]string{}}
}

func (m *MemStore) Create(ctx context.Context, msg Message) (Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if msg.ID == "" {
		msg.ID = newHexID()
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

// Room-related helpers
func (m *MemStore) FindOrCreateRoom(projectId, threadId string) (Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	// find existing
	for _, r := range m.rooms {
		if r.ProjectID == projectId && r.ThreadID == threadId {
			return r, nil
		}
	}
	id := newHexID()
	r := Room{ID: id, ProjectID: projectId, ThreadID: threadId}
	m.rooms[id] = r
	m.projectThreads[projectId] = append(m.projectThreads[projectId], id)
	return r, nil
}

func (m *MemStore) FindRoom(projectId, threadId string) (Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, r := range m.rooms {
		if r.ProjectID == projectId && r.ThreadID == threadId {
			return r, nil
		}
	}
	return Room{}, errors.New("room not found")
}

func (m *MemStore) ListThreads(projectId string) ([]Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := m.projectThreads[projectId]
	out := make([]Room, 0, len(ids))
	for _, id := range ids {
		if r, ok := m.rooms[id]; ok {
			out = append(out, r)
		}
	}
	return out, nil
}

func (m *MemStore) CreateMessageInRoom(ctx context.Context, roomId string, msg Message) (Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if msg.ID == "" {
		msg.ID = newHexID()
	}
	if msg.CreatedAt == 0 {
		msg.CreatedAt = time.Now().Unix()
	}
	msg.RoomID = roomId
	m.items[msg.ID] = msg
	return msg, nil
}

func (m *MemStore) ListMessagesInRoom(ctx context.Context, roomId string) ([]Message, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := []Message{}
	for _, v := range m.items {
		if v.RoomID == roomId {
			out = append(out, v)
		}
	}
	return out, nil
}

func (m *MemStore) DeleteMessage(ctx context.Context, roomId, messageId string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if v, ok := m.items[messageId]; ok {
		if v.RoomID == roomId {
			delete(m.items, messageId)
			return nil
		}
	}
	return nil
}
