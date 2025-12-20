package ssh

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net"
	"time"

	gliderssh "github.com/gliderlabs/ssh"
	sshlib "golang.org/x/crypto/ssh"
	"os/exec"
)

// Server is a minimal SSH server. It starts a gliderlabs SSH server and
// authenticates public keys via the AuthManager's fingerprint lookup.
type Server struct {
	am      *AuthManager
	addr    string
	server  *gliderssh.Server
	ln      net.Listener
	started time.Time
}

func NewServer(am *AuthManager, listenAddr string) *Server {
	s := &Server{am: am, addr: listenAddr}
	sv := &gliderssh.Server{
		Addr: listenAddr,
		PublicKeyHandler: func(ctx gliderssh.Context, key gliderssh.PublicKey) bool {
			// Convert to x/crypto/ssh.PublicKey to compute fingerprint
			pk := sshlib.PublicKey(key)
			fp := FingerprintFromPublicKey(pk)
			// Use the AuthManager to resolve fingerprint -> user
			if am == nil {
				return false
			}
			user, err := am.LookupUserForFingerprint(context.Background(), fp)
			if err != nil {
				return false
			}
			return user != ""
		},
		Handler: func(ses gliderssh.Session) {
			cmd := ses.Command()
			if len(cmd) == 0 {
				ses.Write([]byte("OK\n"))
				ses.Exit(0)
				return
			}
			// Basic support for git service commands: git-upload-pack and git-receive-pack
			if cmd[0] == "git-upload-pack" || cmd[0] == "git-receive-pack" {
				// Expect a single argument: repository path
				if len(cmd) < 2 {
					ses.Write([]byte("ERR: missing repo path\n"))
					ses.Exit(1)
					return
				}
				repo := cmd[1]
				// TODO: sanitize and map repo path to internal store
				// Exec system git command
				proc := exec.Command(cmd[0], repo)
				proc.Stdin = ses
				proc.Stdout = ses
				proc.Stderr = ses.Stderr()
				if err := proc.Run(); err != nil {
					ses.Write([]byte("ERR: " + err.Error() + "\n"))
					ses.Exit(1)
					return
				}
				ses.Exit(0)
				return
			}
			// Fallback
			ses.Write([]byte("OK\n"))
			ses.Exit(0)
		},
	}
	s.server = sv
	return s
}

func (s *Server) Start() error {
	ln, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}
	s.ln = ln
	go func() {
		_ = s.server.Serve(ln)
	}()
	s.started = time.Now()
	return nil
}

func (s *Server) Stop(ctx context.Context) error {
	if s.ln != nil {
		_ = s.ln.Close()
	}
	// gliderlabs server has Close on underlying listener; ensure we stop listening
	return nil
}

// FingerprintFromPublicKey returns the canonical SHA256:<base64> fingerprint
// for an `ssh.PublicKey` as used throughout the codebase.
func FingerprintFromPublicKey(pk sshlib.PublicKey) string {
	d := sha256.Sum256(pk.Marshal())
	b := base64.StdEncoding.EncodeToString(d[:])
	return fmt.Sprintf("SHA256:%s", b)
}
