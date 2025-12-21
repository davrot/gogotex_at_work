package membership

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func IsMember(client *http.Client, baseURL, projectId, userId string) (bool, error) {
	if projectId == "" || userId == "" {
		return false, fmt.Errorf("invalid args")
	}
	url := fmt.Sprintf("%s/internal/api/projects/%s/members/%s", strings.TrimRight(baseURL, "/"), projectId, userId)
	resp, err := client.Get(url)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	var body struct{ Member bool `json:"member"` }
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return false, err
	}
	return body.Member, nil
}
