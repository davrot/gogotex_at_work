package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresStore is a minimal Postgres-backed store for messages.
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
CREATE TABLE IF NOT EXISTS messages (
	id UUID PRIMARY KEY,
	channel TEXT NOT NULL,
	body TEXT NOT NULL,
	created_at BIGINT NOT NULL
);
`)
	return err
}

func (p *PostgresStore) List(ctx context.Context) ([]Message, error) {
	rows, err := p.db.QueryContext(ctx, "SELECT id, channel, body, created_at FROM messages")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.Channel, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *PostgresStore) Publish(ctx context.Context, m Message) (Message, error) {
	if m.ID == "" {
		m.ID = uuid.NewString()
	}
	if m.CreatedAt == 0 {
		m.CreatedAt = time.Now().Unix()
	}
	_, err := p.db.ExecContext(ctx, "INSERT INTO messages (id, channel, body, created_at) VALUES ($1, $2, $3, $4)", m.ID, m.Channel, m.Body, m.CreatedAt)
	if err != nil {
		return Message{}, err
	}
	return m, nil
}
