package token

import (
	"crypto/sha256"
	"encoding/hex"
)

// ComputeHashPrefix computes the canonical 8-character lowercase hex hash prefix
// of the given byte slice (for example, the token hash digest). This function
// can be used to derive the hashPrefix for cross-algorithm compatibility tests.
func ComputeHashPrefix(data []byte) string {
	h := sha256.Sum256(data)
	hh := hex.EncodeToString(h[:])
	return hh[:8]
}
