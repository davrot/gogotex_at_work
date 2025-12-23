package contract

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TestTokenCreateIntrospectRevokeIntegration creates a token via the webprofile API,
// introspects it to confirm active=true, revokes it via DELETE, then re-introspects
// to confirm active=false. The test requires MONGO_URI and assumes TARGET_BASE_URL
// points at a running webprofile instance (default http://localhost:3900).
func TestTokenCreateIntrospectRevokeIntegration(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI not set; skipping integration test")
	}
	ctx := context.Background()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}
	defer client.Disconnect(ctx)

	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	// cleanup any previous tokens for this test user
	coll.DeleteMany(ctx, bson.M{"userId": "revoke-it-user"})

	base := os.Getenv("TARGET_BASE_URL")
	if base == "" {
		base = "http://localhost:3900"
	}

	// Create token
	payload := map[string]interface{}{"label": "revoke-it-label", "scopes": []string{"repo:read"}}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", base+"/internal/api/users/revoke-it-user/git-tokens", bytes.NewReader(b))
	req.SetBasicAuth("overleaf", "overleaf")
	req.Header.Set("Content-Type", "application/json")
	clientHttp := &http.Client{Timeout: 5 * time.Second}
	resp, err := clientHttp.Do(req)
	if err != nil {
		t.Fatalf("http error (create): %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 OK from create, got %d", resp.StatusCode)
	}
	var out map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&out)
	token, ok := out["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected token in create response, got %+v", out)
	}
	id, ok := out["id"].(string)
	if !ok || id == "" {
		t.Fatalf("expected id in create response, got %+v", out)
	}

	// Introspect -> expect active true
	payload2 := map[string]string{"token": token}
	b2, _ := json.Marshal(payload2)
	req2, _ := http.NewRequest("POST", base+"/internal/api/tokens/introspect", bytes.NewReader(b2))
	req2.SetBasicAuth("overleaf", "overleaf")
	req2.Header.Set("Content-Type", "application/json")
	resp2, err := clientHttp.Do(req2)
	if err != nil {
		t.Fatalf("http error (introspect): %v", err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != 200 {
		t.Fatalf("expected 200 OK from introspect, got %d", resp2.StatusCode)
	}
	var out2 map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&out2)
	if active, ok := out2["active"].(bool); !ok || !active {
		t.Fatalf("expected active true after create/introspect, got %+v", out2)
	}

	// Revoke via DELETE
	req3, _ := http.NewRequest("DELETE", base+"/internal/api/users/revoke-it-user/git-tokens/"+id, nil)
	req3.SetBasicAuth("overleaf", "overleaf")
	resp3, err := clientHttp.Do(req3)
	if err != nil {
		t.Fatalf("http error (revoke): %v", err)
	}
	defer resp3.Body.Close()
	if resp3.StatusCode != 204 {
		t.Fatalf("expected 204 No Content from revoke, got %d", resp3.StatusCode)
	}

    // Poll introspect until active=false or timeout
    deadline := time.Now().Add(15 * time.Second)
    var lastOut map[string]interface{}
    success := false
    for time.Now().Before(deadline) {
        req4, _ := http.NewRequest("POST", base+"/internal/api/tokens/introspect", bytes.NewReader(b2))
        req4.SetBasicAuth("overleaf", "overleaf")
        req4.Header.Set("Content-Type", "application/json")
        resp4, err := clientHttp.Do(req4)
        if err != nil {
            // record the error and retry
            lastOut = map[string]interface{}{"error": err.Error()}
        } else {
            var out4 map[string]interface{}
            // try to decode JSON, fallback to raw body if decode fails
            if err := json.NewDecoder(resp4.Body).Decode(&out4); err != nil {
                // attempt to read raw body
                // (we avoid reading here to keep code simple; record a decode note)
                lastOut = map[string]interface{}{"note": "failed to decode JSON"}
            } else {
                lastOut = out4
                if active, ok := out4["active"].(bool); ok && !active {
                    success = true
                    break
                }
            }
            resp4.Body.Close()
        }
        time.Sleep(150 * time.Millisecond)
    }
    if !success {
        // attempt to fetch the token list from the API for diagnostics
        var listBody interface{}
        listReq, _ := http.NewRequest("GET", base+"/internal/api/users/revoke-it-user/git-tokens", nil)
        listReq.SetBasicAuth("overleaf", "overleaf")
        if listResp, err := clientHttp.Do(listReq); err == nil {
            json.NewDecoder(listResp.Body).Decode(&listBody)
            listResp.Body.Close()
        } else {
            listBody = map[string]interface{}{"error": err.Error()}
        }
        t.Fatalf("introspect did not reflect revocation within timeout; last response: %+v; list: %+v", lastOut, listBody)
    }

    // cleanup
    coll.DeleteMany(ctx, bson.M{"userId": "revoke-it-user"})
}
