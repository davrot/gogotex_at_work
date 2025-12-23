package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresStore is a minimal PostgreSQL-backed store implementation.
// It ensures the required table exists on creation.
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore creates a new PostgresStore from a database connection and
// ensures the schema is present.
func NewPostgresStore(db *sql.DB) (*PostgresStore, error) {
	p := &PostgresStore{db: db}
	if err := p.ensureSchema(); err != nil {
		return nil, fmt.Errorf("ensure schema: %w", err)
	}
	return p, nil
}

func (p *PostgresStore) ensureSchema() error {
	_, err := p.db.Exec(`
	CREATE TABLE IF NOT EXISTS contacts (
		id UUID PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL
	);
	`)
	return err
}

// List returns all contacts from Postgres.
func (p *PostgresStore) List(_ context.Context) ([]Contact, error) {
	rows, err := p.db.Query("SELECT id, name, email FROM contacts")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Contact{}
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Email); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// Create inserts a contact into Postgres and returns the created record.
func (p *PostgresStore) Create(_ context.Context, c Contact) (Contact, error) {
	if c.ID == "" {
		// let Postgres generate a UUID via gen_random_uuid() if available
		// but to keep dependency minimal, generate a UUID in Go
		return Contact{}, errors.New("contact ID must be provided in Postgres mode")
	}
	_, err := p.db.Exec("INSERT INTO contacts (id, name, email) VALUES ($1, $2, $3)", c.ID, c.Name, c.Email)
	if err != nil {
		return Contact{}, err
	}
	return c, nil
}
