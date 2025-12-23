package store

import (
	"context"
	"testing"
)

func TestMemStore_CreateList(t *testing.T) {
	m := NewMemStore()
	ctx := context.Background()
	r := PushRecord{Repo: "git@github.com:acme/repo.git", Ref: "refs/heads/main", Author: "dev"}
	out, err := m.Create(ctx, r)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if out.ID == "" {
		t.Fatalf("expected ID set")
	}
	all, err := m.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1, got %d", len(all))
	}
}
