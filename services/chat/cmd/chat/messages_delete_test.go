package main

import (
	"net/http/httptest"
	"testing"
	"encoding/json"
	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func TestDeleteMessage(t *testing.T) {
	s := store.New()
	m := []map[string]interface{}{{"_id": "m1", "content": "hello"}}
	b, _ := json.Marshal(m)
	s.Put("messages:abc:t1", string(b))

	// delete
	req := httptest.NewRequest("DELETE", "/project/abc/threads/t1/messages/m1", nil)
	w := httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	if w.Result().StatusCode != 204 {
		t.Fatalf("expected 204 on delete, got %d", w.Result().StatusCode)
	}

	// verify empty
	req2 := httptest.NewRequest("GET", "/project/abc/threads/t1/messages", nil)
	w2 := httptest.NewRecorder()
	messagesHandlerWithStore(s, w2, req2)
	var out []map[string]interface{}
	_ = json.NewDecoder(w2.Body).Decode(&out)
	if len(out) != 0 {
		t.Fatalf("expected empty messages after delete, got %+v", out)
	}
}
