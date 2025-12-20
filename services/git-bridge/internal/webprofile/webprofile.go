package webprofile

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type IntrospectResponse struct {
	Active  bool   `json:"active"`
	UserId  string `json:"userId"`
	Scopes  []string `json:"scopes"`
	Expires string `json:"expiresAt"`
}

func IntrospectToken(client *http.Client, baseURL, token string) (string, bool, error) {
	if token == "" {
		return "", false, fmt.Errorf("empty token")
	}
	url := strings.TrimRight(baseURL, "/") + "/internal/api/tokens/introspect"
	payload := map[string]string{"token": token}
	b, _ := json.Marshal(payload)
	resp, err := client.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		return "", false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", false, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	var ir IntrospectResponse
	if err := json.NewDecoder(resp.Body).Decode(&ir); err != nil {
		return "", false, err
	}
	return ir.UserId, ir.Active, nil
}
