package lookup

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type FingerprintResponse struct {
	UserId string `json:"userId"`
}

func LookupFingerprint(client *http.Client, baseURL string, fingerprint string) (string, error) {
	if !strings.HasPrefix(fingerprint, "SHA256:") {
		return "", fmt.Errorf("malformed fingerprint")
	}
	url := fmt.Sprintf("%s/internal/api/ssh-keys/%s", strings.TrimRight(baseURL, "/"), fingerprint)
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return "", nil
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	var fr FingerprintResponse
	if err := json.NewDecoder(resp.Body).Decode(&fr); err != nil {
		return "", err
	}
	return fr.UserId, nil
}
