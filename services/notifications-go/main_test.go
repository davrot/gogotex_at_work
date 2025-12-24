package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/overleaf/notifications-go/internal/notifications"
	"github.com/overleaf/notifications-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestNotificationsEndpoints(t *testing.T) {
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

	// Test notifications endpoints with timeout
	t.Run("Notifications endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Create a memory store for testing
		memStore := store.NewMemStore()
		
		// Create a handler with the memory store
		handler := notifications.NewHandler(memStore)
		
		// Create a ServeMux
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})
		handler.Register(mux)
		
		// Test POST /notifications (create)
		body := strings.NewReader(`{"recipient":"test@example.com","message":"Test message","id":"11111111-1111-1111-1111-111111111111"}`)
		req := httptest.NewRequest("POST", "/notifications", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /notifications (list)
		req = httptest.NewRequest("GET", "/notifications", nil)
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
		notification := store.Notification{
			Recipient: "test@example.com",
			Message:   "Test message",
			Status:    "pending",
		}
		created, err := store.Create(context.Background(), notification)
		assert.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, notification.Recipient, created.Recipient)
		assert.Equal(t, notification.Message, created.Message)
		assert.Equal(t, notification.Status, created.Status)

		// Test List
		listed, err := store.List(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listed, 1)
		assert.Equal(t, created.ID, listed[0].ID)
		assert.Equal(t, created.Recipient, listed[0].Recipient)
		assert.Equal(t, created.Message, listed[0].Message)
		assert.Equal(t, created.Status, listed[0].Status)
	})
}