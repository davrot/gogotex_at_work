package ssh

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	sshlib "golang.org/x/crypto/ssh"
)

func TestServerAuthAcceptsKnownKey(t *testing.T) {
	// start lookup server that returns a user for the given fingerprint
	lookupServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"userId":"u-test"}`))
	}))
	defer lookupServer.Close()

	// ensure env points to lookup server
	os.Setenv("SSH_LOOKUP_BASE_URL", lookupServer.URL)
	am, err := NewAuthManagerFromEnv(lookupServer.Client())
	if err != nil {
		t.Fatalf("NewAuthManagerFromEnv: %v", err)
	}
	// create server on random port
	s := NewServer(am, "127.0.0.1:0")
	if err := s.Start(); err != nil {
		t.Fatalf("Server Start error: %v", err)
	}
	// pick actual listening address
	addr := s.ln.Addr().String()
	// generate client key
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("key gen: %v", err)
	}
	signer, err := sshlib.NewSignerFromKey(key)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	config := &sshlib.ClientConfig{
		User: "git",
		Auth: []sshlib.AuthMethod{sshlib.PublicKeys(signer)},
		HostKeyCallback: func(hostname string, remote net.Addr, key sshlib.PublicKey) error { return nil },
		Timeout: 5 * time.Second,
	}
	// dial
	// allow short time for server to start
	time.Sleep(50 * time.Millisecond)
	c, err := sshlib.Dial("tcp", addr, config)
	if err != nil {
		t.Fatalf("ssh dial: %v", err)
	}
	defer c.Close()
	// create session
	sess, err := c.NewSession()
	if err != nil {
		t.Fatalf("new session: %v", err)
	}
	defer sess.Close()
	b, err := sess.CombinedOutput("echo test")
	if err != nil {
		t.Fatalf("session error: %v, output: %s", err, string(b))
	}
	if string(b) != "OK\n" {
		t.Fatalf("unexpected output: %q", string(b))
	}
	// stop server
	_ = s.Stop(context.Background())
}
