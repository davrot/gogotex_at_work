package token

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"testing"
)

func TestSha256HexPrefixCanonical(t *testing.T) {
	in := "s3cr3t"
	h := sha256.Sum256([]byte(in))
	expected := hex.EncodeToString(h[:])[:8]
	got := sha256Hex(in)[:8]
	if got != expected {
		t.Fatalf("expected prefix %s got %s", expected, got)
	}
	// assert format
	re := regexp.MustCompile(`^[0-9a-f]{8}$`)
	if !re.MatchString(got) {
		t.Fatalf("hashPrefix format invalid: %s", got)
	}
}
