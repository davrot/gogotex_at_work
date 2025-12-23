package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresStore is a minimal Postgres-backed implementation for git-bridge.
type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) (*PostgresStore, error) {
	p := &PostgresStore{db: db}
	if err := p.ensureSchema(); err != nil {
		return nil, fmt.Errorf("ensure schema: %w", err)
	}
	return p, nil
}

func (p *PostgresStore) ensureSchema() error {
	_, err := p.db.Exec(`
CREATE TABLE IF NOT EXISTS pushes (
	id UUID PRIMARY KEY,
	repo TEXT NOT NULL,
	ref TEXT NOT NULL,
	author TEXT NOT NULL,
	created_at BIGINT NOT NULL
);
`)
	return err
}

func (p *PostgresStore) List(ctx context.Context) ([]PushRecord, error) {
	rows, err := p.db.QueryContext(ctx, "SELECT id, repo, ref, author, created_at FROM pushes")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PushRecord{}
	for rows.Next() {
		var r PushRecord
		if err := rows.Scan(&r.ID, &r.Repo, &r.Ref, &r.Author, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *PostgresStore) Create(ctx context.Context, r PushRecord) (PushRecord, error) {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	if r.CreatedAt == 0 {
		r.CreatedAt = time.Now().Unix()
	}
	_, err := p.db.ExecContext(ctx, "INSERT INTO pushes (id, repo, ref, author, created_at) VALUES ($1, $2, $3, $4, $5)", r.ID, r.Repo, r.Ref, r.Author, r.CreatedAt)
	if err != nil {
		return PushRecord{}, err
	}
	return r, nil
}
