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

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	mock.ExpectQuery("SELECT id, channel, body, created_at FROM messages").WillReturnError(fmt.Errorf("query-fail"))
	_, err = ps.List(context.Background())
	if err == nil || !strings.Contains(err.Error(), "query-fail") {
		t.Fatalf("expected query-fail error, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestPostgresStore_Publish_ExecError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("CREATE TABLE IF NOT EXISTS messages").WillReturnResult(sqlmock.NewResult(0, 0))
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	m := Message{Channel: "ch", Body: "b"}
	mock.ExpectExec("INSERT INTO messages").WithArgs(sqlmock.AnyArg(), m.Channel, m.Body, sqlmock.AnyArg()).WillReturnError(fmt.Errorf("exec-fail"))
	_, err = ps.Publish(context.Background(), m)
	if err == nil || !strings.Contains(err.Error(), "exec-fail") {
		t.Fatalf("expected exec-fail error, got: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
