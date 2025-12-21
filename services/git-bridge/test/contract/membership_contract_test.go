package contract

import (
	"net"
	"net/http"
	"os"
	"testing"
	"time"
)

func getBaseURL() string {
	if v := os.Getenv("TARGET_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:3900"
}

func isPortOpen(host string, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", host, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// TestMembershipEndpointNonMemberForbidden is a contract-style test that asserts
// membership queries for non-members do not return 200. This test assumes the
// webprofile-api is reachable at TARGET_BASE_URL (default: http://localhost:3900).
// The test will be skipped if the server is not available (useful for local runs
// where the server isn't started automatically).
func TestMembershipEndpointNonMemberForbidden(t *testing.T) {
	base := getBaseURL()
	// Skip if server is not reachable
	if !isPortOpen("localhost:3900", 200*time.Millisecond) {
		t.Skip("webprofile-api not running on localhost:3900; set up the server or set TARGET_BASE_URL to run this contract test")
	}

	// Use canonical membership lookup path from the spec. If your deployment
	// expects a different path or parameters, set TARGET_BASE_URL accordingly.
	req, err := http.NewRequest("GET", base+"/internal/api/projects/example-project/members/non-member", nil)
	if err != nil {
		t.Fatalf("creating request: %v", err)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	// Non-member lookup should not return 200 OK. Accept 401/403/404 as valid
	// non-membership responses depending on implementation details.
	if resp.StatusCode == http.StatusOK {
		t.Fatalf("expected non-member lookup to not return 200 OK, got %d", resp.StatusCode)
	}
}
