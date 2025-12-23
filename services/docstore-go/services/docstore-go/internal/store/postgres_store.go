package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib" // register pgx driver with database/sql
)

// PostgresStore is a minimal PostgreSQL-backed implementation for documents.
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore creates a new PostgresStore and ensures schema exists.
func NewPostgresStore(db *sql.DB) (*PostgresStore, error) {
	p := &PostgresStore{db: db}
	if err := p.ensureSchema(); err != nil {
		return nil, fmt.Errorf("ensure schema: %w", err)
	}
	return p, nil
}

func (p *PostgresStore) ensureSchema() error {
	_, err := p.db.Exec(`
	CREATE TABLE IF NOT EXISTS documents (
		id UUID PRIMARY KEY,
		title TEXT NOT NULL,
		body TEXT,
		created_at BIGINT NOT NULL
	);
	`)
	return err
}

// List returns all documents from Postgres.
func (p *PostgresStore) List(_ context.Context) ([]Document, error) {
	rows, err := p.db.Query("SELECT id, title, body, created_at FROM documents")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []Document{}
	for rows.Next() {
		var d Document
		if err := rows.Scan(&d.ID, &d.Title, &d.Body, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

// Create inserts a document into Postgres and returns the created record.
func (p *PostgresStore) Create(_ context.Context, d Document) (Document, error) {
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	if d.CreatedAt == 0 {
		d.CreatedAt = 0
	}
	_, err := p.db.Exec("INSERT INTO documents (id, title, body, created_at) VALUES ($1, $2, $3, $4)", d.ID, d.Title, d.Body, d.CreatedAt)
	if err != nil {
		return Document{}, err
	}
	return d, nil
}
