package token

import (
	"context"
	"os"
	"testing"
	"time"
)

// Integration test for MongoPersistor. Skips if no Mongo URL provided.
func TestMongoPersistor_Integration(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = os.Getenv("MONGO_URL")
	}
	if uri == "" {
		t.Skip("MONGO_URI/MONGO_URL not set; skipping integration test")
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

// Test that revocation is observed within 500ms (revocation immediacy)
func TestMongoPersistor_RevocationImmediacy(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = os.Getenv("MONGO_URL")
	}
	if uri == "" {
		t.Skip("MONGO_URI/MONGO_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	p, err := NewMongoPersistor(ctx, uri, "testdb", "tokens_test")
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	token := "rev-immediacy-token"
	if err := p.Save(ctx, token, "u-101", []string{"repo:read"}); err != nil {
		t.Fatalf("save: %v", err)
	}
	// ensure active
	meta, err := p.Introspect(ctx, token)
	if err != nil {
		t.Fatalf("introspect: %v", err)
	}
	if !meta.Active {
		t.Fatalf("expected active before revoke")
	}
	if err := p.Revoke(ctx, token); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	// poll for up to 500ms
	observedFalse := false
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		m, err := p.Introspect(ctx, token)
		if err != nil {
			t.Fatalf("introspect during poll: %v", err)
		}
		if !m.Active {
			observedFalse = true
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if !observedFalse {
		t.Fatalf("expected introspect to be inactive within 500ms after revoke")
	}
}
