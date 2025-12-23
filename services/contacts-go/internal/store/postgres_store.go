package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib" // required to register pgx driver with database/sql
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
func (p *PostgresStore) List(ctx context.Context) ([]Contact, error) {
	rows, err := p.db.QueryContext(ctx, "SELECT id, name, email FROM contacts")
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// Create inserts a contact into Postgres and returns the created record.
func (p *PostgresStore) Create(ctx context.Context, c Contact) (Contact, error) {
	// Ensure ID exists; generate server-side UUID if absent
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	_, err := p.db.ExecContext(ctx, "INSERT INTO contacts (id, name, email) VALUES ($1, $2, $3)", c.ID, c.Name, c.Email)
	if err != nil {
		return Contact{}, err
	}
	return c, nil
}
