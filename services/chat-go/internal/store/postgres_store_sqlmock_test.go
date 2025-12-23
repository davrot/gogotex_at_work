package store

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestPostgresStore_Create_List(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	// Ensure schema exec expectation runs during NewPostgresStore
	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(1, 1))

	sqlDB := db
	p, err := NewPostgresStore(sqlDB)
	require.NoError(t, err)

	// Expect insert returning id
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO messages")).WithArgs("alice", "hello", sqlmock.AnyArg()).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))

	created, err := p.Create(context.Background(), Message{Author: "alice", Content: "hello", CreatedAt: time.Now().Unix()})
	require.NoError(t, err)
	require.Equal(t, "42", created.ID)

	// Expect select
	rows := sqlmock.NewRows([]string{"id", "sender", "content", "created_at"}).AddRow(42, "alice", "hello", time.Now().Unix())
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, sender, content, created_at FROM messages ORDER BY id DESC LIMIT $1")).WithArgs(10).WillReturnRows(rows)

	list, err := p.List(context.Background(), 10)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "42", list[0].ID)
}