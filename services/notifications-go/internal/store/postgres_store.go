package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresStore is a minimal Postgres-backed implementation for notifications.
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
CREATE TABLE IF NOT EXISTS notifications (
	id UUID PRIMARY KEY,
	recipient TEXT NOT NULL,
	message TEXT NOT NULL,
	status TEXT NOT NULL,
	created_at BIGINT NOT NULL
);
`)
	return err
}

func (p *PostgresStore) List(ctx context.Context) ([]Notification, error) {
	rows, err := p.db.QueryContext(ctx, "SELECT id, recipient, message, status, created_at FROM notifications")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Recipient, &n.Message, &n.Status, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *PostgresStore) Create(ctx context.Context, n Notification) (Notification, error) {
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	if n.CreatedAt == 0 {
		n.CreatedAt = time.Now().Unix()
	}
	if n.Status == "" {
		n.Status = "queued"
	}
	_, err := p.db.ExecContext(ctx, "INSERT INTO notifications (id, recipient, message, status, created_at) VALUES ($1, $2, $3, $4, $5)", n.ID, n.Recipient, n.Message, n.Status, n.CreatedAt)
	if err != nil {
		return Notification{}, err
	}
	return n, nil
} 
