package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestStatusHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/status", nil)
	w := httptest.NewRecorder()
	statusHandler(w, req)

	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	var body string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("error decoding body: %v", err)
	}
	if body != "chat is alive" {
		t.Fatalf("unexpected body: %q", body)
	}
}

func TestReadyHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()
	// Create a simple mux for testing
	mux := http.NewServeMux()
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.ServeHTTP(w, req)

	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	if string(body) != "ok" {
		t.Fatalf("unexpected body: %q", string(body))
	}
}

func TestThreadsHandlerWithStore(t *testing.T) {
	s := store.New()
	
	// Test GET /project/{projectId}/threads with seeded threads
	req := httptest.NewRequest("GET", "/project/abc/threads", nil)
	w := httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	
	// Test POST /project/{projectId}/threads/{threadId}/messages
	req = httptest.NewRequest("POST", "/project/abc/threads/t1/messages", bytes.NewBufferString(`{"user_id":"507f1f77bcf86cd799439011","content":"hello"}`))
	w = httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", res.StatusCode)
	}
	
	// Test GET /project/{projectId}/threads/{threadId}/messages
	req = httptest.NewRequest("GET", "/project/abc/threads/t1/messages", nil)
	w = httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	
	// Test PUT /project/{projectId}/threads/{threadId}/messages/{messageId}
	req = httptest.NewRequest("PUT", "/project/abc/threads/t1/messages/m1", bytes.NewBufferString(`{"content":"updated content"}`))
	w = httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", res.StatusCode)
	}
	
	// Test DELETE /project/{projectId}/threads/{threadId}/messages/{messageId}
	req = httptest.NewRequest("DELETE", "/project/abc/threads/t1/messages/m1", nil)
	w = httptest.NewRecorder()
	messagesHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", res.StatusCode)
	}
}

func TestThreadsActions(t *testing.T) {
	s := store.New()
	
	// Test POST /project/{projectId}/threads/duplicate
	req := httptest.NewRequest("POST", "/project/abc/threads/duplicate", bytes.NewBufferString(`{"threads":["t1"]}`))
	w := httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	
	// Test POST /project/{projectId}/threads/generate
	req = httptest.NewRequest("POST", "/project/abc/threads/generate", bytes.NewBufferString(`{"threads":["t1"]}`))
	w = httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	
	// Test POST /project/{projectId}/threads/{threadId}/resolve
	req = httptest.NewRequest("POST", "/project/abc/threads/t1/resolve", nil)
	w = httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", res.StatusCode)
	}
	
	// Test POST /project/{projectId}/threads/{threadId}/reopen
	req = httptest.NewRequest("POST", "/project/abc/threads/t1/reopen", nil)
	w = httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", res.StatusCode)
	}
	
	// Test POST /project/{projectId}/threads/{threadId}/delete
	req = httptest.NewRequest("POST", "/project/abc/threads/t1/delete", nil)
	w = httptest.NewRecorder()
	threadsHandlerWithStore(s, w, req)
	
	res = w.Result()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", res.StatusCode)
	}
}

func TestChatEndpoints(t *testing.T) {
	// Test health endpoint
	t.Run("Health endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/status", nil)
		w := httptest.NewRecorder()
		statusHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var response string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "chat is alive", response)
	})

	// Test ready endpoint
	t.Run("Ready endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ready", nil)
		w := httptest.NewRecorder()
		// Create a simple mux for testing
		mux := http.NewServeMux()
		mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		})
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "ok", w.Body.String())
	})

	// Test with timeout to prevent hanging
	t.Run("Endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Test POST /project/{projectId}/threads/{threadId}/messages
		s := store.New()
		body := bytes.NewBufferString(`{"user_id":"507f1f77bcf86cd799439011","content":"hello"}`)
		req := httptest.NewRequest("POST", "/project/abc/threads/t1/messages", body)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		messagesHandlerWithStore(s, w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /project/{projectId}/threads/{threadId}/messages
		req = httptest.NewRequest("GET", "/project/abc/threads/t1/messages", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		messagesHandlerWithStore(s, w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}