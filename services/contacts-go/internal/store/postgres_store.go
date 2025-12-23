package store

import (
	"context"
	"database/sql"
	"errors"
)

// PostgresStore is a scaffold for a PostgreSQL-backed store implementation.
// TODO: implement using database/sql or a preferred DB driver (pgx/sqlx) and
// add migration scripts and integration test harness.
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore creates a new PostgresStore from a database connection.
func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (p *PostgresStore) List(_ context.Context) ([]Contact, error) {
	return nil, errors.New("not implemented")
}

func (p *PostgresStore) Create(_ context.Context, _ Contact) (Contact, error) {
	return Contact{}, errors.New("not implemented")
}
