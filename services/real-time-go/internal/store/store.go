package store

import (
	"context"
)

// Message represents a published message in the real-time service.
type Message struct {
	ID        string `json:"id"`
	Channel   string `json:"channel"`
	Body      string `json:"body"`
	CreatedAt int64  `json:"created_at"`
}

// Store provides message persistence for the service.
type Store interface {
	List(ctx context.Context) ([]Message, error)
	Publish(ctx context.Context, m Message) (Message, error)
}
