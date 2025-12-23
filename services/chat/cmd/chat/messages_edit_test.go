package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func TestEditMessage(t *testing.T) {
	s := store.New()
	// seed store with one message
	m := []map[string]interface{}{{"_id": "m1", "content": "hello", "user_id": "507f1f77bcf86cd799439011"}}
	b, _ := json.Marshal(m)
	s.Put("messages:abc:t1", string(b))

	// edit
	req := httptest.NewRequest("PUT", "/project/abc/threads/t1/messages/m1", bytes.NewBufferString(`{"content":"updated"}`))
	w := httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	if w.Result().StatusCode != 204 {
		t.Fatalf("expected 204 on edit, got %d", w.Result().StatusCode)
	}

	// verify
	req2 := httptest.NewRequest("GET", "/project/abc/threads/t1/messages", nil)
	w2 := httptest.NewRecorder()
	messagesHandlerWithStore(s, w2, req2)
	var out []map[string]interface{}
	_ = json.NewDecoder(w2.Body).Decode(&out)
	if len(out) == 0 || out[0]["content"] != "updated" {
		t.Fatalf("expected updated content, got %+v", out)
	}
}
