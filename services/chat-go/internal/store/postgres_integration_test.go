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

	_ "github.com/jackc/pgx/v5/stdlib"
)

// TestPostgresStoreIntegration uses an ephemeral Postgres container and validates
// the DB using in-container psql commands (no host port mapping required).
// Run locally with RUN_DB_INTEGRATION=1 to enable.
func TestPostgresStoreIntegration(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION") != "1" {
		t.Skip("skipping DB integration test; set RUN_DB_INTEGRATION=1 to run")
	}

	container := fmt.Sprintf("chat_test_pg_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=chat", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	// Wait for Postgres to be ready using in-container psql
	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/chat", "-c", "\\l")
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

	// Create a table and insert a row using in-container psql as a quick smoke test
	nid := fmt.Sprintf("m-%d", time.Now().UnixNano())
	insertCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "chat", "-c", fmt.Sprintf("CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT NOT NULL, content TEXT NOT NULL, created_at BIGINT NOT NULL); INSERT INTO messages (sender, content, created_at) VALUES ('%s','%s',%d);", nid, "me", time.Now().Unix()))
	if out, err := insertCmd.CombinedOutput(); err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback insert failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	selectCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "chat", "-c", fmt.Sprintf("SELECT id, sender FROM messages WHERE sender='%s';", "me"))
	out, err = selectCmd.CombinedOutput()
	if err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback select failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	if !strings.Contains(string(out), "me") {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback select did not return inserted row: %s\ncontainer logs:\n%s", string(out), string(logOut))
	}
}

// Optional networked validation: runs the Go-level PostgresStore inside a helper
// container attached to the Postgres container's network. To run: RUN_DB_INTEGRATION_REMOTE=1
func TestPostgresStoreNetworked(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {
		t.Skip("skipping remote networked DB integration; set RUN_DB_INTEGRATION_REMOTE=1 to run")
	}

	container := fmt.Sprintf("chat_test_pg_net_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=chat", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/chat", "-c", "\\l")
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
	t.Logf("helper output:\n%s", string(out))
	if err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("remote helper test failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
}

func TestPostgresStoreRemoteInner(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION_REMOTE") != "1" {
		t.Skip("skipping remote-inner; should run only inside helper container")
	}
	dsn := "postgres://postgres:pass@localhost:5432/chat?sslmode=disable"
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer func() { _ = db.Close() }()
	p, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}

	// Basic create/list
	m := Message{Author: "me@example.com", Content: "hello"}
	out, err := p.Create(context.Background(), m)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected ID to be generated")
	}

	// Ensure created_at was set and is recent
	if out.CreatedAt == 0 || time.Unix(out.CreatedAt, 0).Before(time.Now().Add(-1*time.Minute)) {
		t.Fatalf("unexpected created_at: %v", out.CreatedAt)
	}

	// Verify presence
	all, err := p.List(context.Background(), 100)
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
		t.Fatalf("created message not present in list")
	}

	// --- Transient DB error via trigger ---
	// Create a function that raises on content = 'bad'
	_, _ = db.Exec(`CREATE OR REPLACE FUNCTION fail_if_bad() RETURNS trigger AS $$ BEGIN IF NEW.content = 'bad' THEN RAISE EXCEPTION 'forced fail'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`)
	_, _ = db.Exec(`CREATE TRIGGER fail_insert BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION fail_if_bad();`)

	// Inserting 'bad' should fail
	_, err = p.Create(context.Background(), Message{Author: "x", Content: "bad"})
	if err == nil {
		t.Fatalf("expected insert to fail due to trigger")
	}

	// Remove the trigger/function
	_, _ = db.Exec(`DROP TRIGGER IF EXISTS fail_insert ON messages`)
	_, _ = db.Exec(`DROP FUNCTION IF EXISTS fail_if_bad()`)

	// Now insert should succeed
	_, err = p.Create(context.Background(), Message{Author: "x", Content: "good"})
	if err != nil {
		t.Fatalf("expected insert to succeed after removing trigger: %v", err)
	}

	// --- Table lock blocking simulation ---
	// Open a second DB connection and start a transaction that locks the table
	db2, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db2: %v", err)
	}
	defer func() { _ = db2.Close() }()
	tx, err := db2.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	// Acquire an exclusive lock
	if _, err := tx.Exec(`LOCK TABLE messages IN ACCESS EXCLUSIVE MODE`); err != nil {
		t.Fatalf("lock table: %v", err)
	}

	// Attempt create with short timeout; should fail due to blocking
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	_, err = p.Create(ctx, Message{Author: "blocked", Content: "x"})
	if err == nil {
		t.Fatalf("expected create to fail due to lock/blocking")
	}

	// Release lock
	_ = tx.Rollback()

	// After releasing, create should succeed
	_, err = p.Create(context.Background(), Message{Author: "after", Content: "x"})
	if err != nil {
		t.Fatalf("expected create to succeed after lock release: %v", err)
	}

	// --- Concurrency & large payload checks (kept from before) ---
	const N = 20
	errs := make(chan error, N)
	for i := 0; i < N; i++ {
		i := i
		go func() {
			_, err := p.Create(context.Background(), Message{Author: fmt.Sprintf("u%d", i), Content: "x"})
			errs <- err
		}()
	}
	for i := 0; i < N; i++ {
		if err := <-errs; err != nil {
			t.Fatalf("concurrent create failed: %v", err)
		}
	}

	// Large payload
	large := make([]byte, 2*1024*1024) // 2MB payload for remote test
	for i := range large {
		large[i] = 'b'
	}
	m2 := Message{Author: "big", Content: string(large)}
	out2, err := p.Create(context.Background(), m2)
	if err != nil {
		t.Fatalf("Create large payload failed: %v", err)
	}
	if out2.ID == "" {
		t.Fatalf("expected ID for large payload")
	}

	// Verify ordering/limit: request small limit and ensure we get that many
	lst, err := p.List(context.Background(), 5)
	if err != nil {
		t.Fatalf("List small limit failed: %v", err)
	}
	if len(lst) > 5 {
		t.Fatalf("expected at most 5 rows, got %d", len(lst))
	}

	// Ensure large payload is eventually retrievable
	all2, err := p.List(context.Background(), 1000)
	if err != nil {
		t.Fatalf("List large limit failed: %v", err)
	}
	foundBig := false
	for _, ee := range all2 {
		if ee.ID == out2.ID {
			foundBig = true
			break
		}
	}
	if !foundBig {
		t.Fatalf("large payload message not found in list")
	}
}
