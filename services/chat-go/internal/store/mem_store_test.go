package store

import (
	"context"
	"testing"
)

func TestMemStore_CreateList(t *testing.T) {
	m := NewMemStore()
	ctx := context.Background()
	msg := Message{Content: "hello", Author: "alice"}
	out, err := m.Create(ctx, msg)
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
	if all[0].Content != "hello" || all[0].Author != "alice" {
		t.Fatalf("unexpected message: %+v", all[0])
	}
}
