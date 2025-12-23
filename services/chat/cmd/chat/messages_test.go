package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func TestSendMessageValidation(t *testing.T) {
	s := store.New()
	// missing content
	req := httptest.NewRequest("POST", "/project/abc/threads/t1/messages", bytes.NewBufferString(`{"user_id":"507f1f77bcf86cd799439011"}`))
	w := httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	res := w.Result()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing content, got %d", res.StatusCode)
	}

	// invalid user id
	req2 := httptest.NewRequest("POST", "/project/abc/threads/t1/messages", bytes.NewBufferString(`{"user_id":"bad","content":"hello"}`))
	w2 := httptest.NewRecorder()
	messagesHandlerWithStore(s, w2, req2)
	res2 := w2.Result()
	if res2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid user id, got %d", res2.StatusCode)
	}

	// happy path
	req3 := httptest.NewRequest("POST", "/project/abc/threads/t1/messages", bytes.NewBufferString(`{"user_id":"507f1f77bcf86cd799439011","content":"hello"}`))
	w3 := httptest.NewRecorder()
	messagesHandlerWithStore(s, w3, req3)
	res3 := w3.Result()
	if res3.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 for created message, got %d", res3.StatusCode)
	}
}
