package store

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestPostgresStore_List_OrderAndLimit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	require.NoError(t, err)

	rows := sqlmock.NewRows([]string{"id", "sender", "content", "created_at"}).
		AddRow(3, "alice", "m3", time.Now().Unix()).
		AddRow(2, "bob", "m2", time.Now().Unix())
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, sender, content, created_at FROM messages ORDER BY id DESC LIMIT $1")).WithArgs(2).WillReturnRows(rows)

	list, err := p.List(context.Background(), 2)
	require.NoError(t, err)
	require.Len(t, list, 2)
	require.Equal(t, "3", list[0].ID)
	require.Equal(t, "2", list[1].ID)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPostgresStore_Concurrent_Create(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	require.NoError(t, err)

	const N = 10
	// prepare expectations for N inserts
	for i := 0; i < N; i++ {
		mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO messages")).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(i + 1))
	}

	var wg sync.WaitGroup
	errs := make([]error, N)
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = p.Create(context.Background(), Message{Author: fmt.Sprintf("u%d", i), Content: "x"})
		}(i)
	}
	wg.Wait()
	for i := 0; i < N; i++ {
		require.NoError(t, errs[i])
	}
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPostgresStore_EnsureSchema_Idempotent(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	// expect two schema ensures (two constructor calls)
	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(0, 0))
	p1, err := NewPostgresStore(db)
	require.NoError(t, err)

	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(0, 0))
	p2, err := NewPostgresStore(db)
	require.NoError(t, err)

	// ensure both are usable
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO messages")).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	_, err = p1.Create(context.Background(), Message{Author: "a", Content: "c"})
	require.NoError(t, err)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, sender, content, created_at FROM messages ORDER BY id DESC LIMIT $1")).WithArgs(1).WillReturnRows(sqlmock.NewRows([]string{"id", "sender", "content", "created_at"}).AddRow(1, "a", "c", time.Now().Unix()))
	list, err := p2.List(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPostgresStore_Create_LargePayload(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta("CREATE TABLE IF NOT EXISTS messages")).WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	require.NoError(t, err)

	large := make([]byte, 10*1024*1024) // 10MB payload
	for i := range large {
		large[i] = 'a'
	}

	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO messages")).WithArgs("alice", string(large), sqlmock.AnyArg()).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(123))
	m, err := p.Create(context.Background(), Message{Author: "alice", Content: string(large)})
	require.NoError(t, err)
	require.Equal(t, "123", m.ID)
	require.NoError(t, mock.ExpectationsWereMet())
}
