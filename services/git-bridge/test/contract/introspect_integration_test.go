package contract

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/alexedwards/argon2id"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestIntrospectIntegration_Bcrypt(t *testing.T) {
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
	// prepare token doc
	plain := "my-test-token-1234"
	hash, _ := argon2id.CreateHash(plain, argon2id.DefaultParams)
	doc := bson.M{
		"userId": "u-test",
		"label": "it-test",
		"hash": hash,
		"hashPrefix": func() string { h, _ := argon2id.CreateHash(plain, argon2id.DefaultParams); return h }(),
		"algorithm": "argon2id",
		"scopes": []string{"repo:read"},
		"active": true,
		"createdAt": time.Now(),
	}
	res, err := coll.InsertOne(ctx, doc)
	if err != nil {
		t.Fatalf("insert token doc: %v", err)
	}
	defer coll.DeleteOne(ctx, bson.M{"_id": res.InsertedID})

	// Start the server under test (use actual binary?) — for simplicity call the running local endpoint
	base := os.Getenv("TARGET_BASE_URL")
	if base == "" {
		base = "http://localhost:3900"
	}

	payload := map[string]string{"token": plain}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", base+"/internal/api/tokens/introspect", bytes.NewReader(b))
	req.SetBasicAuth("overleaf", "overleaf")
	req.Header.Set("Content-Type", "application/json")
	clientHttp := &http.Client{Timeout: 5 * time.Second}
	resp, err := clientHttp.Do(req)
	if err != nil {
		t.Fatalf("http error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 OK from introspect, got %d", resp.StatusCode)
	}
	var out map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&out)
	if active, ok := out["active"].(bool); !ok || !active {
		t.Fatalf("expected active true, got %+v", out)
	}
}
