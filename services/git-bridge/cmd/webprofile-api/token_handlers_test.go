package main

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

func TestTokenCreateAndIntrospectIntegration(t *testing.T) {
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

	// Clean up any previous tokens for user
	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	coll.DeleteMany(ctx, bson.M{"userId": "int-test-user"})

	// Call create endpoint
	base := os.Getenv("TARGET_BASE_URL")
	if base == "" {
		base = "http://localhost:3900"
	}

	payload := map[string]interface{}{ "label": "it-label", "scopes": []string{"repo:read"} }
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", base+"/internal/api/users/int-test-user/git-tokens", bytes.NewReader(b))
	req.SetBasicAuth("overleaf", "overleaf")
	req.Header.Set("Content-Type", "application/json")
	clientHttp := &http.Client{Timeout: 5 * time.Second}
	resp, err := clientHttp.Do(req)
	if err != nil {
		t.Fatalf("http error: %v", err)
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

	// Now introspect using the same endpoint
	payload2 := map[string]string{"token": token}
	b2, _ := json.Marshal(payload2)
	req2, _ := http.NewRequest("POST", base+"/internal/api/tokens/introspect", bytes.NewReader(b2))
	req2.SetBasicAuth("overleaf", "overleaf")
	req2.Header.Set("Content-Type", "application/json")
	resp2, err := clientHttp.Do(req2)
	if err != nil {
		t.Fatalf("http error introspect: %v", err)
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

	// cleanup
	coll.DeleteMany(ctx, bson.M{"userId": "int-test-user"})
}
