package store

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// TestList_ScanError ensures a malformed column causes Scan to fail and the error is returned.
func TestPostgresStore_List_ScanError(t *testing.T) {
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

	// Return a row where created_at is a non-integer to provoke Scan error
	rows := sqlmock.NewRows([]string{"id", "repo", "ref", "author", "created_at"}).AddRow("x", "r", "refs/heads/main", "a", "not-an-int")
	mock.ExpectQuery("SELECT id, repo, ref, author, created_at FROM pushes").WillReturnRows(rows)

	_, err = ps.List(context.Background())
	if err == nil {
		t.Fatalf("expected scan error, got nil")
	}
	// The exact error text may vary by driver; ensure it's non-nil
	if err.Error() == "" {
		t.Fatalf("expected non-empty error message")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// TestCreate_ExecDeadline ensures an Exec that delays beyond the context deadline returns an error.
func TestPostgresStore_Create_ExecDeadline(t *testing.T) {
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

	r := PushRecord{Repo: "r", Ref: "refs/heads/main", Author: "a"}
	// Make Exec delay for 200ms but we'll set a 50ms deadline
	mock.ExpectExec("INSERT INTO pushes").WithArgs(sqlmock.AnyArg(), r.Repo, r.Ref, r.Author, sqlmock.AnyArg()).WillDelayFor(200 * time.Millisecond).WillReturnResult(sqlmock.NewResult(1, 1))

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err = ps.Create(ctx, r)
	if err == nil {
		t.Fatalf("expected context deadline error, got nil")
	}
	// Accept either DeadlineExceeded or Cancelled wording
	if err.Error() == "" {
		t.Fatalf("expected non-empty error message")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
