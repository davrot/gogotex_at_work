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

// TestPostgresStoreIntegration uses an ephemeral Postgres container and validates
// the DB using in-container psql commands (no host port mapping required).
// Run locally with RUN_DB_INTEGRATION=1 to enable.
func TestPostgresStoreIntegration(t *testing.T) {
	if os.Getenv("RUN_DB_INTEGRATION") != "1" {
		t.Skip("skipping DB integration test; set RUN_DB_INTEGRATION=1 to run")
	}

	container := fmt.Sprintf("gitbridge_test_pg_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=gitbridge", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	// Wait for Postgres to be ready using in-container psql
	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/gitbridge", "-c", "\\l")
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
	pid := fmt.Sprintf("p-%d", time.Now().UnixNano())
	insertCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "gitbridge", "-c", fmt.Sprintf("CREATE TABLE IF NOT EXISTS pushes (id UUID PRIMARY KEY, repo TEXT NOT NULL, ref TEXT NOT NULL, author TEXT NOT NULL, created_at BIGINT NOT NULL); INSERT INTO pushes (id, repo, ref, author, created_at) VALUES ('%s','%s','%s','%s',%d);", pid, "git@github.com:acme/repo.git", "refs/heads/main", "dev", time.Now().Unix()))
	if out, err := insertCmd.CombinedOutput(); err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback insert failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	selectCmd := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "-U", "postgres", "-d", "gitbridge", "-c", fmt.Sprintf("SELECT id, repo FROM pushes WHERE id='%s';", pid))
	out, err = selectCmd.CombinedOutput()
	if err != nil {
		logOut, _ := exec.Command("docker", "logs", container).CombinedOutput()
		t.Fatalf("fallback select failed: %v: %s\ncontainer logs:\n%s", err, string(out), string(logOut))
	}
	if !strings.Contains(string(out), pid) {
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

	container := fmt.Sprintf("gitbridge_test_pg_net_%d", time.Now().UnixNano())
	cmd := exec.Command("docker", "run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=pass", "-e", "POSTGRES_DB=gitbridge", "postgres:15-alpine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run failed: %v: %s", err, string(out))
	}
	defer func() { _ = exec.Command("docker", "rm", "-f", container).Run() }()

	retries := 60
	for i := 0; i < retries; i++ {
		check := exec.Command("docker", "run", "--rm", "--network", "container:"+container, "postgres:15-alpine", "psql", "postgresql://postgres:pass@localhost:5432/gitbridge", "-c", "\\l")
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
	dsn := "postgres://postgres:pass@localhost:5432/gitbridge?sslmode=disable"
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer func() { _ = db.Close() }()
	ps, err := NewPostgresStore(db)
	if err != nil {
		t.Fatalf("NewPostgresStore: %v", err)
	}
	r := PushRecord{Repo: "git@github.com:acme/repo.git", Ref: "refs/heads/main", Author: "dev"}
	out, err := ps.Create(context.Background(), r)
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
		t.Fatalf("created push not present in list")
	}
}
