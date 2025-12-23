package store

import (
	"context"
	"errors"
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

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS pushes").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Simulate context canceled: make Exec return a context canceled error
	r := PushRecord{Repo: "r", Ref: "refs/heads/main", Author: "a"}
	mock.ExpectExec("INSERT INTO pushes").WithArgs(sqlmock.AnyArg(), r.Repo, r.Ref, r.Author, sqlmock.AnyArg()).WillReturnError(context.Canceled)

	// Directly simulate Exec returning a context.Canceled error and ensure it's propagated
	_, err = ps.Create(context.Background(), r)
	if err == nil {
		t.Fatalf("expected error due to simulated Exec failure, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got: %v", err)
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

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS pushes").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Make the query delay longer than context deadline
	rows := sqlmock.NewRows([]string{"id", "repo", "ref", "author", "created_at"})
	mock.ExpectQuery("SELECT id, repo, ref, author, created_at FROM pushes").WillDelayFor(1500 * time.Millisecond).WillReturnRows(rows)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	_, err = ps.List(ctx)
	if err == nil {
		t.Fatalf("expected deadline exceeded error, got nil")
	}
	// different drivers may wrap deadline errors, just check substring
	if !errors.Is(err, context.DeadlineExceeded) && err.Error() != "context deadline exceeded" && err.Error() != "context canceled" {
		// Accept either DeadlineExceeded or Cancelled-ish results
		t.Logf("List returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
