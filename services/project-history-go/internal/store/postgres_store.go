package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib" // register pgx driver
)

// PostgresStore is a minimal PostgreSQL-backed implementation for events.
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
CREATE TABLE IF NOT EXISTS events (
	id UUID PRIMARY KEY,
	project_id UUID NOT NULL,
	type TEXT NOT NULL,
	payload TEXT,
	created_at BIGINT NOT NULL
);
`)
	return err
}

// List returns all events.
func (p *PostgresStore) List(_ context.Context) ([]Event, error) {
	rows, err := p.db.Query("SELECT id, project_id, type, payload, created_at FROM events")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Type, &e.Payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// Create inserts an event and returns the created record.
func (p *PostgresStore) Create(_ context.Context, e Event) (Event, error) {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.CreatedAt == 0 {
		e.CreatedAt = time.Now().Unix()
	}
	_, err := p.db.Exec("INSERT INTO events (id, project_id, type, payload, created_at) VALUES ($1, $2, $3, $4, $5)", e.ID, e.ProjectID, e.Type, e.Payload, e.CreatedAt)
	if err != nil {
		return Event{}, err
	}
	return e, nil
}
