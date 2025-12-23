package store

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestPostgresStore_List_QueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS notifications").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	mock.ExpectQuery("SELECT id, recipient, message, status, created_at FROM notifications").WillReturnError(fmt.Errorf("query-fail"))
	_, err = ps.List(context.Background())
	if err == nil || !strings.Contains(err.Error(), "query-fail") {
		t.Fatalf("expected query-fail error, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_Create_ExecError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS notifications").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	n := Notification{Recipient: "me@example.com", Message: "h"}
	mock.ExpectExec("INSERT INTO notifications").WithArgs(sqlmock.AnyArg(), n.Recipient, n.Message, n.Status, sqlmock.AnyArg()).WillReturnError(fmt.Errorf("exec-fail"))
	_, err = ps.Create(context.Background(), n)
	if err == nil || !strings.Contains(err.Error(), "exec-fail") {
		t.Fatalf("expected exec-fail error, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
