package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/overleaf/docstore-go/internal/documents"
	"github.com/overleaf/docstore-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestDocstoreEndpoints(t *testing.T) {
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

	// Test document endpoints with timeout
	t.Run("Document endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Create a memory store for testing
		memStore := store.NewMemStore()
		
		// Create a handler with the memory store
		handler := documents.NewHandler(memStore)
		
		// Create a ServeMux
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})
		handler.Register(mux)
		
		// Test POST /documents (create)
		body := strings.NewReader(`{"title":"test.tex","body":"\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"}`)
		req := httptest.NewRequest("POST", "/documents", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /documents (list)
		req = httptest.NewRequest("GET", "/documents", nil)
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
		document := store.Document{
			Title: "test.tex",
			Body:  "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}",
		}
		created, err := store.Create(context.Background(), document)
		assert.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, document.Title, created.Title)
		assert.Equal(t, document.Body, created.Body)

		// Test List
		listed, err := store.List(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listed, 1)
		assert.Equal(t, created.ID, listed[0].ID)
		assert.Equal(t, created.Title, listed[0].Title)
		assert.Equal(t, created.Body, listed[0].Body)
	})
}