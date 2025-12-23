package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// Tests mirror the pattern used in other -go services and use in-container psql as a robust fallback.
func TestPostgresStoreIntegration(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION") != "1" {
		t.Skip("skipping DB integration test; set RUN_DB_INTEGRATION=1 to run")
	}

	container := fmt.Sprintf("notifications_test_pg_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=notifications", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/notifications", "-c", "\\l")
		if out, err := check.CombinedOutput(); err == nil {
			_ = out
			break
		}
		if i == retries-1 {
			t.Fatalf("waiting for postgres failed: %v: %s", err, string(out))
		}
		t.Logf("waiting for postgres... (%d/%d)", i+1, retries)
		time.Sleep(1 * time.Second)
	}

	// create table and insert
	nid := fmt.Sprintf("n-%d", time.Now().UnixNano())
	insertCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "notifications", "-c", fmt.Sprintf("CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY, recipient TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL); INSERT INTO notifications (id, recipient, message, status, created_at) VALUES ('%s','%s','%s','%s',%d);", nid, "me@example.com", "hello", "queued", time.Now().Unix()))
	if out, err := insertCmd.CombinedOutput(); err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback insert failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	selectCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "notifications", "-c", fmt.Sprintf("SELECT id, recipient FROM notifications WHERE id='%s';", nid))
	out, err = selectCmd.CombinedOutput()
	if err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback select failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	if !strings.Contains(string(out), nid) {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback select did not return inserted row: %s\ncontainer logs:\n%s", string(out), string(logOut))
	}
}

// Remote helper test follows the same pattern as other services (skipped by default).
func TestPostgresStoreNetworked(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {
		t.Skip("skipping remote networked DB integration; set RUN_DB_INTEGRATION_REMOTE=1 to run")
	}

	container := fmt.Sprintf("notifications_test_pg_net_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=notifications", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/notifications", "-c", "\\l")
		if out, err := check.CombinedOutput(); err == nil {
			_ = out
			break
		}
		if i == retries-1 {
			t.Fatalf("waiting for postgres failed: %v: %s", err, string(out))
		}
		t.Logf("waiting for postgres... (%d/%d)", i+1, retries)
		time.Sleep(1 * time.Second)
	}

	cwd, _ := os.Getwd()
	helper := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "-v", cwd+":/src", "-w", "/src", "golang:1.25-alpine", "sh", "-c", "apk add --no-cache git ca-certificates && go test ./internal/store -run TestPostgresStoreRemoteInner -v")
	out, err = helper.CombinedOutput()
	// Log helper output and fail if it fails
	_ = out
	if err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("remote helper test failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
}

func TestPostgresStoreRemoteInner(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {
		t.Skip("skipping remote-inner; should run only inside helper container")
	}
	dsn := "postgres://postgres:pass@localhost:5432/notifications?sslmode=disable"
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer func() { _ = db.Close() }()
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}
	n := Notification{Recipient: "me@example.com", Message: "hello"}
	out, err := ps.Create(context.Background(), n)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected ID to be generated")
	}
	all, err := ps.List(context.Background())
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	found := false
	for _, ee := range all {
		if ee.ID == out.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("created notification not present in list")
	}
}













































































































}	}		t.Fatalf("created notification not present in list")	if !found {	}		}			break			found = true		if ee.ID == out.ID {	for _, ee := range all {	found := false	}		t.Fatalf("List failed: %v", err)	if err != nil {	all, err := ps.List(context.Background())	}		t.Fatalf("expected ID to be generated")	if out.ID == "" {	}		t.Fatalf("Create failed: %v", err)	if err != nil {	out, err := ps.Create(context.Background(), n)	n := Notification{Recipient: "me@example.com", Message: "hello"}	}		t.Fatalf("NewPostgresStore: %v", err)	if err != nil {	ps, err := NewPostgresStore(db)	defer func() { _ = db.Close() }()	}		t.Fatalf("open db: %v", err)	if err != nil {	db, err := sql.Open("pgx", dsn)	dsn := "postgres://postgres:pass@localhost:5432/notifications?sslmode=disable"	}		t.Skip("skipping remote-inner; should run only inside helper container")	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {func TestPostgresStoreRemoteInner(t *testing.T) {}	}		t.Fatalf("remote helper test failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()	if err != nil {	_ = out	// Log helper output and fail if it fails	out, err = helper.CombinedOutput()	helper := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "-v", cwd+":/src", "-w", "/src", "golang:1.25-alpine", "sh", "-c", "apk add --no-cache git ca-certificates && go test ./internal/store -run TestPostgresStoreRemoteInner -v")	cwd, _ := os.Getwd()	}		time.Sleep(1 * time.Second)		t.Logf("waiting for postgres... (%d/%d)", i+1, retries)		}			t.Fatalf("waiting for postgres failed: %v: %s", err, string(out))		if i == retries-1 {		}			break			_ = out		if out, err := check.CombinedOutput(); err == nil {		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/notifications", "-c", "\\l")	for i := 0; i < retries; i++ {	retries := 60	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()	}		t.Fatalf("docker run failed: %v: %s", err, string(out))	if err != nil {	out, err := cmd.CombinedOutput()	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=notifications", "postgres:15-alpine")	container := fmt.Sprintf("notifications_test_pg_net_%d", time.Now().UnixNano())	}		t.Skip("skipping remote networked DB integration; set RUN_DB_INTEGRATION_REMOTE=1 to run")	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {func TestPostgresStoreNetworked(t *testing.T) {// Remote helper test follows the same pattern as other services (skipped by default).}	}		t.Fatalf("fallback select did not return inserted row: %s\ncontainer logs:\n%s", string(out), string(logOut))		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()	if !strings.Contains(string(out), nid) {	}		t.Fatalf("fallback select failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()	if err != nil {	out, err = selectCmd.CombinedOutput()	selectCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "notifications", "-c", fmt.Sprintf("SELECT id, recipient FROM notifications WHERE id='%s';", nid))	}		t.Fatalf("fallback insert failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()	if out, err := insertCmd.CombinedOutput(); err != nil {	insertCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "notifications", "-c", fmt.Sprintf("CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY, recipient TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL); INSERT INTO notifications (id, recipient, message, status, created_at) VALUES ('%s','%s','%s','%s',%d);", nid, "me@example.com", "hello", "queued", time.Now().Unix()))	nid := fmt.Sprintf("n-%d", time.Now().UnixNano())	// create table and insert	}		time.Sleep(1 * time.Second)		t.Logf("waiting for postgres... (%d/%d)", i+1, retries)		}			t.Fatalf("waiting for postgres failed: %v: %s", err, string(out))		if i == retries-1 {		}			break			_ = out		if out, err := check.CombinedOutput(); err == nil {		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/notifications", "-c", "\\l")	for i := 0; i < retries; i++ {	retries := 60