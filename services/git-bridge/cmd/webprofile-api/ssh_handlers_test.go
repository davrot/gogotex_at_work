package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestCreateMalformedPublicKey(t *testing.T) {
	// This test can run without MongoDB since validation happens before DB ops
	reqBody := bytes.NewBufferString(`{"public_key": "-----BEGIN PRIVATE KEY-----\nMII...", "key_name": "k"}`)
	req, _ := http.NewRequest("POST", "/internal/api/users/u1/ssh-keys", reqBody)
	rr := httptest.NewRecorder()
	// call createHandler with nil coll; validation should trigger before DB use
	createHandler(context.Background(), rr, req, nil)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed key, got %d", rr.Code)
	}
	var out map[string]string
	json.NewDecoder(rr.Body).Decode(&out)
	if out["message"] != "invalid public key" {
		t.Fatalf("unexpected body: %v", out)
	}
}

func TestCreateAndDeleteIntegration(t *testing.T) {
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

	coll := client.Database("sharelatex").Collection("usersshkeys")
	// cleanup
	coll.DeleteMany(ctx, bson.M{"userId": "int-ssh-user"})

	// Create
	pub := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample"
	payload := map[string]string{"public_key": pub, "key_name": "it-ssh"}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/internal/api/users/int-ssh-user/ssh-keys", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	createHandler(ctx, rr, req, coll)
	if rr.Code != 201 && rr.Code != 200 {
		t.Fatalf("expected 201/200 from create, got %d", rr.Code)
	}
	var out map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&out)
	fp, _ := out["fingerprint"].(string)
	if fp == "" {
		t.Fatalf("expected fingerprint in create response, got %+v", out)
	}

	// List
	req2, _ := http.NewRequest("GET", "/internal/api/users/int-ssh-user/ssh-keys", nil)
	rr2 := httptest.NewRecorder()
	listHandler(ctx, rr2, req2, coll)
	if rr2.Code != 200 {
		t.Fatalf("expected 200 from list, got %d", rr2.Code)
	}
	// ensure fingerprint present in list
	var arr []map[string]interface{}
	json.NewDecoder(rr2.Body).Decode(&arr)
	if len(arr) == 0 {
		t.Fatalf("expected non-empty list from list handler")
	}

	// Find id to delete
	id := arr[0]["id"]
	idStr := ""
	if s, ok := id.(string); ok { idStr = s }
	if idStr == "" {
		// try object id forms
		idStr = fmt.Sprintf("%v", id)
	}

	// Delete
	req3, _ := http.NewRequest("DELETE", "/internal/api/users/int-ssh-user/ssh-keys/"+idStr, nil)
	rr3 := httptest.NewRecorder()
	deleteHandler(ctx, rr3, req3, coll)
	if rr3.Code != http.StatusNoContent {
		t.Fatalf("expected 204 from delete, got %d", rr3.Code)
	}

	// Confirm deletion
	req4, _ := http.NewRequest("GET", "/internal/api/users/int-ssh-user/ssh-keys", nil)
	rr4 := httptest.NewRecorder()
	listHandler(ctx, rr4, req4, coll)
	var arr2 []map[string]interface{}
	json.NewDecoder(rr4.Body).Decode(&arr2)
	// Should be empty or not contain the fingerprint
	for _, e := range arr2 {
		if e["fingerprint"] == fp {
			t.Fatalf("expected fingerprint to be deleted, still present: %s", fp)
		}
	}

	// cleanup
	coll.DeleteMany(ctx, bson.M{"userId": "int-ssh-user"})
}
