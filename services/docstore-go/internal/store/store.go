package store

import "context"

// Document represents a stored document.
type Document struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	CreatedAt int64  `json:"created_at"`
}

// Store defines the storage operations we need for docstore.
type Store interface {
	Create(ctx context.Context, d Document) (Document, error)
	List(ctx context.Context) ([]Document, error)
}
