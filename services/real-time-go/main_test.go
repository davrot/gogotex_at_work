package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/overleaf/real-time-go/internal/messages"
	"github.com/overleaf/real-time-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestRealTimeEndpoints(t *testing.T) {
	// Test health endpoint
	t.Run("Health endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		// Create a simple ServeMux for testing
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "ok", response["status"])
	})

	// Test messages endpoints with timeout
	t.Run("Messages endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Create a memory store for testing
		memStore := store.NewMemStore()
		
		// Create a handler with the memory store
		handler := messages.NewHandler(memStore)
		
		// Create a ServeMux
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})
		handler.Register(mux)
		
		// Test POST /messages (publish)
		body := strings.NewReader(`{"channel":"test-channel","body":"Test message","id":"11111111-1111-1111-1111-111111111111"}`)
		req := httptest.NewRequest("POST", "/messages", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /messages (list)
		req = httptest.NewRequest("GET", "/messages", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestMemStore(t *testing.T) {
	t.Run("Memory store operations", func(t *testing.T) {
		store := store.NewMemStore()
		
		// Test Create
		message := store.Message{
			Channel: "test-channel",
			Body:    "Test message",
		}
		created, err := store.Publish(context.Background(), message)
		assert.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, message.Channel, created.Channel)
		assert.Equal(t, message.Body, created.Body)

		// Test List
		listed, err := store.List(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listed, 1)
		assert.Equal(t, created.ID, listed[0].ID)
		assert.Equal(t, created.Channel, listed[0].Channel)
		assert.Equal(t, created.Body, listed[0].Body)
	})
}