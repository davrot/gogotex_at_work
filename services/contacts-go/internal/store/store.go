package store

import "context"

// Contact represents a small contact record
type Contact struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Store defines the subset of operations we need
type Store interface {
	List(ctx context.Context) ([]Contact, error)
	Create(ctx context.Context, c Contact) (Contact, error)
}
