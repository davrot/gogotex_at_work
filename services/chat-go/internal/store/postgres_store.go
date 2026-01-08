package store

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresStore is a minimal Postgres-backed store for chat messages.
// It uses database/sql so tests can use sqlmock easily and integration tests
// can use the pgx stdlib driver.
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
	id SERIAL PRIMARY KEY,
	sender TEXT NOT NULL,
	content TEXT NOT NULL,
	created_at BIGINT NOT NULL
)
`)
	return err
}

func (p *PostgresStore) Create(ctx context.Context, msg Message) (Message, error) {
	if msg.CreatedAt == 0 {
		msg.CreatedAt = time.Now().Unix()
	}
	var id int64
	row := p.db.QueryRowContext(ctx, `INSERT INTO messages (sender, content, created_at) VALUES ($1, $2, $3) RETURNING id`, msg.Author, msg.Content, msg.CreatedAt)
	if err := row.Scan(&id); err != nil {
		return Message{}, fmt.Errorf("scan id: %w", err)
	}
	msg.ID = strconv.FormatInt(id, 10)
	return msg, nil
}

func (p *PostgresStore) List(ctx context.Context, limit int) ([]Message, error) {
	rows, err := p.db.QueryContext(ctx, `SELECT id, sender, content, created_at FROM messages ORDER BY id DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var id int64
		var sender, content string
		var createdAt int64
		if err := rows.Scan(&id, &sender, &content, &createdAt); err != nil {
			return nil, err
		}
		m := Message{
			ID:        strconv.FormatInt(id, 10),
			Author:    sender,
			Content:   content,
			CreatedAt: createdAt,
		}
		msgs = append(msgs, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return msgs, nil
}
