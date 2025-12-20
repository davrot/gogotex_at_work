package ssh

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"

	sshlib "golang.org/x/crypto/ssh"
)

func TestFingerprintFromPublicKey(t *testing.T) {
	// generate ephemeral RSA key
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	pub, err := sshlib.NewPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("failed to build ssh public key: %v", err)
	}
	fp := FingerprintFromPublicKey(pub)
	if len(fp) == 0 {
		t.Fatalf("expected non-empty fingerprint")
	}
	if fp[:7] != "SHA256:" {
		t.Fatalf("unexpected fingerprint prefix: %s", fp)
	}
}
