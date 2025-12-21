package contract

import (
	"os/exec"
	"testing"
)

func TestCompareIntrospectParity(t *testing.T) {
	script := "../../../../scripts/contract/compare_introspect.sh"
	cmd := exec.Command(script)
	cmd.Env = append(cmd.Env, "NODE_BASE=http://develop-web-1:3000", "GO_BASE=http://localhost:3900")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("compare_introspect failed: %v\noutput: %s", err, string(out))
	}
	// script prints NODE_CODE=... GO_CODE=... so success is when they're equal
}
