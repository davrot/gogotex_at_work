package token

import (
	"testing"
	"encoding/hex"
)

func TestComputeHashPrefixLength(t *testing.T) {
	p := ComputeHashPrefix([]byte("hello world"))
	if len(p) != 8 {
		t.Fatalf("expected prefix length 8, got %d: %s", len(p), p)
	}
}

func TestComputeHashPrefixDeterministic(t *testing.T) {
	p1 := ComputeHashPrefix([]byte("same"))
	p2 := ComputeHashPrefix([]byte("same"))
	if p1 != p2 {
		t.Fatalf("expected deterministic prefix, got %s and %s", p1, p2)
	}
	// sanity check hex chars
	_, err := hex.DecodeString(p1)
	if err != nil {
		t.Fatalf("prefix should be valid hex: %v", err)
	}
}
