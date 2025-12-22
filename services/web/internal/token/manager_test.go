package token

import (
	"testing"
)

func TestManagerCreateIntrospectRevoke(t *testing.T) {
	m := New()
	m.Create("tok-123", "u-1", []string{"repo:read"})
	meta, ok := m.Introspect("tok-123")
	if !ok || !meta.Active || meta.UserID != "u-1" {
		t.Fatalf("unexpected meta after create: %+v ok=%v", meta, ok)
	}
	m.Revoke("tok-123")
	meta2, ok2 := m.Introspect("tok-123")
	if !ok2 || meta2.Active {
		t.Fatalf("expected revoked token, got %+v ok=%v", meta2, ok2)
	}
}
