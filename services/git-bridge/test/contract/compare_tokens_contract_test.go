package contract

import (
	"os/exec"
	"testing"
)

func TestCompareTokensParity(t *testing.T) {
	script := "../../../../scripts/contract/compare_tokens_parity.sh"
	cmd := exec.Command(script)
	cmd.Env = append(cmd.Env, "NODE_BASE=http://develop-web-1:3000", "GO_BASE=http://localhost:3900")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("compare_tokens_parity failed: %v\noutput: %s", err, string(out))
	}
}
