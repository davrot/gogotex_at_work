package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/overleaf/project-history-go/internal/events"
	"github.com/overleaf/project-history-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestProjectHistoryEndpoints(t *testing.T) {
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

	// Test project history endpoints with timeout
	t.Run("Project history endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Create a memory store for testing
		memStore := store.NewMemStore()
		
		// Create a handler with the memory store
		handler := events.NewHandler(memStore)
		
		// Create a ServeMux
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})
		handler.Register(mux)
		
		// Test POST /events (create)
		body := strings.NewReader(`{"project_id":"test-project","type":"create","payload":"{\"file\":\"test.tex\"}"}`)
		req := httptest.NewRequest("POST", "/events", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /events (list)
		req = httptest.NewRequest("GET", "/events", nil)
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
		event := store.Event{
			ProjectID: "test-project",
			Type:      "create",
			Payload:   `{"file":"test.tex"}`,
		}
		created, err := store.Create(context.Background(), event)
		assert.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, event.ProjectID, created.ProjectID)
		assert.Equal(t, event.Type, created.Type)
		assert.Equal(t, event.Payload, created.Payload)

		// Test List
		listed, err := store.List(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listed, 1)
		assert.Equal(t, created.ID, listed[0].ID)
		assert.Equal(t, created.ProjectID, listed[0].ProjectID)
		assert.Equal(t, created.Type, listed[0].Type)
		assert.Equal(t, created.Payload, listed[0].Payload)
	})
}