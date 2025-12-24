package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMessages_CreateAndList(t *testing.T) {
	// Create
	payload := map[string]string{"content": "hi", "author": "bob"}
	b, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/messages", bytes.NewReader(b))
	w := httptest.NewRecorder()
	messagesCreateHandler(w, req)
	res := w.Result()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 created, got %d", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	var created map[string]interface{}
	_ = json.Unmarshal(body, &created)
	if created["content"] != "hi" || created["author"] != "bob" {
		t.Fatalf("unexpected created body: %s", string(body))
	}

	// List
	req = httptest.NewRequest("GET", "/messages", nil)
	w = httptest.NewRecorder()
	messagesListHandler(w, req)
	res = w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d", res.StatusCode)
	}
	body, _ = io.ReadAll(res.Body)
	var list []map[string]interface{}
	_ = json.Unmarshal(body, &list)
	if len(list) == 0 {
		t.Fatalf("expected non-empty list")
	}
}
