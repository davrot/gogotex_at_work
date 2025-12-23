package store

import (
	"context"
)

// Notification represents a queued or delivered notification.
type Notification struct {
	ID        string `json:"id"`
	Recipient string `json:"recipient"`
	Message   string `json:"message"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"created_at"`
}

// Store abstracts notification persistence/queue.
type Store interface {
	List(ctx context.Context) ([]Notification, error)
	Create(ctx context.Context, n Notification) (Notification, error)
}











