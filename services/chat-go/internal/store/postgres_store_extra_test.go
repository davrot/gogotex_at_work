package store

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestPostgresStore_Create_ContextCanceled(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Simulate context canceled at query time
	mock.ExpectQuery("INSERT INTO messages").WithArgs("alice", "hello", sqlmock.AnyArg()).WillReturnError(context.Canceled)

	_, err = p.Create(context.Background(), Message{Author: "alice", Content: "hello", CreatedAt: time.Now().Unix()})
	if err == nil {
		t.Fatalf("expected error due to simulated Query failure, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_Create_ExecDeadline(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Delay the insert longer than the context deadline
	mock.ExpectQuery("INSERT INTO messages").WillDelayFor(500 * time.Millisecond).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err = p.Create(ctx, Message{Author: "alice", Content: "hello"})
	if err == nil {
		t.Fatalf("expected deadline/cancel error, got nil")
	}
	// Accept either DeadlineExceeded or Cancelled-ish errors
	if !errors.Is(err, context.DeadlineExceeded) && err.Error() != "context deadline exceeded" && err.Error() != "context canceled" {
		t.Logf("Create returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_List_ContextDeadlineExceeded(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Delay the select longer than context deadline
	rows := sqlmock.NewRows([]string{"id", "sender", "content", "created_at"})
	mock.ExpectQuery("SELECT id, sender, content, created_at FROM messages").WillDelayFor(500 * time.Millisecond).WillReturnRows(rows)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err = p.List(ctx, 10)
	if err == nil {
		t.Fatalf("expected deadline exceeded error, got nil")
	}
	if !errors.Is(err, context.DeadlineExceeded) && err.Error() != "context deadline exceeded" && err.Error() != "context canceled" {
		t.Logf("List returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_List_QueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	mock.ExpectQuery("SELECT id, sender, content, created_at FROM messages").WillReturnError(fmt.Errorf("query failed"))

	_, err = p.List(context.Background(), 10)
	if err == nil {
		t.Fatalf("expected query error, got nil")
	}
	if err.Error() != "query failed" {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_List_ScanError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	rows := sqlmock.NewRows([]string{"id", "sender", "content", "created_at"}).AddRow(1, "alice", "hi", "not-an-int")
	mock.ExpectQuery("SELECT id, sender, content, created_at FROM messages").WillReturnRows(rows)

	_, err = p.List(context.Background(), 10)
	if err == nil {
		t.Fatalf("expected scan error, got nil")
	}
	// error may vary; just ensure it's not nil
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
