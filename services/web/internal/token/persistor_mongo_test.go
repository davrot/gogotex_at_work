package token

import (
	"context"
	"os"
	"testing"
	"time"
)

// Integration test for MongoPersistor. Skips if MONGO_URL unset.
func TestMongoPersistor_Integration(t *testing.T) {
	uri := os.Getenv("MONGO_URL")
	if uri == "" {
		t.Skip("MONGO_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	p, err := NewMongoPersistor(ctx, uri, "testdb", "tokens_test")
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// use a deterministic token
	token := "mongo-int-test-token"
	if err := p.Save(ctx, token, "u-99", []string{"repo:read"}); err != nil {
		t.Fatalf("save: %v", err)
	}
	meta, err := p.Introspect(ctx, token)
	if err != nil {
		t.Fatalf("introspect: %v", err)
	}
	if meta.UserID != "u-99" || !meta.Active {
		t.Fatalf("unexpected meta: %+v", meta)
	}
	if err := p.Revoke(ctx, token); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	meta2, err := p.Introspect(ctx, token)
	if err != nil {
		t.Fatalf("introspect after revoke: %v", err)
	}
	if meta2.Active {
		t.Fatalf("expected inactive after revoke, got %+v", meta2)
	}
}
