package store

import (
	"context"
)

// Event represents a simple project history event.
type Event struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Type      string `json:"type"`
	Payload   string `json:"payload,omitempty"`
	CreatedAt int64  `json:"created_at"`
}

// Store abstracts event storage for the service.
type Store interface {
	List(ctx context.Context) ([]Event, error)
	Create(ctx context.Context, e Event) (Event, error)
}











