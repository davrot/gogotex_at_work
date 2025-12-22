package token

import (
	"testing"
)

func TestSha256HexPrefix(t *testing.T) {
	h := sha256Hex("test-token")
	if len(h) != 64 {
		t.Fatalf("expected 64-char sha256 hex, got %d", len(h))
	}
	if len(h[:8]) != 8 {
		t.Fatalf("expected 8-char prefix, got %d", len(h[:8]))
	}
}
