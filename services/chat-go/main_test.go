package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestChatEndpoints(t *testing.T) {
	// Test health endpoint
	t.Run("Health endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		healthHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "ok", response["status"])
	})

	// Test global messages endpoint
	t.Run("Global messages endpoint", func(t *testing.T) {
		// Test GET /messages
		req := httptest.NewRequest("GET", "/messages", nil)
		w := httptest.NewRecorder()
		messagesListHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		// Test POST /messages
		body := strings.NewReader(`{"content":"test message","author":"test_user"}`)
		req = httptest.NewRequest("POST", "/messages", body)
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		messagesCreateHandler(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
	})

	// Test project-scoped endpoints with timeout
	t.Run("Project endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Test POST /project/{projectId}/thread/{threadId}/resolve
		body := strings.NewReader(`{"user_id":"test-user"}`)
		req := httptest.NewRequest("POST", "/project/test-project/thread/test-thread/resolve", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		projectHandler(w, req)
		// These endpoints should not crash, we're not checking exact status codes
		// since they're placeholders that return 204 for now
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test POST /project/{projectId}/thread/{threadId}/reopen
		req = httptest.NewRequest("POST", "/project/test-project/thread/test-thread/reopen", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test POST /project/{projectId}/thread/{threadId}/delete
		req = httptest.NewRequest("POST", "/project/test-project/thread/test-thread/delete", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test PUT /project/{projectId}/messages/{messageId}
		req = httptest.NewRequest("PUT", "/project/test-project/messages/test-message", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test DELETE /project/{projectId}/messages/{messageId}
		req = httptest.NewRequest("DELETE", "/project/test-project/messages/test-message", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test GET /project/{projectId}/threads/resolved
		req = httptest.NewRequest("GET", "/project/test-project/threads/resolved", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test POST /project/{projectId}/threads/duplicate
		body = strings.NewReader(`{"threads":["test-thread"]}`)
		req = httptest.NewRequest("POST", "/project/test-project/threads/duplicate", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)

		// Test DELETE /project/{projectId}
		req = httptest.NewRequest("DELETE", "/project/test-project", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		projectHandler(w, req)
		assert.NotEqual(t, http.StatusInternalServerError, w.Code)
	})
}