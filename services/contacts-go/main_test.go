package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/contacts"
	"github.com/overleaf/contacts-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestContactsEndpoints(t *testing.T) {
	// Set gin to test mode
	gin.SetMode(gin.TestMode)

	// Test health endpoint
	t.Run("Health endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		// Create a simple gin router for testing
		r := gin.New()
		r.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "ok", response["status"])
	})

	// Test contacts endpoints with timeout
	t.Run("Contacts endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Create a memory store for testing
		memStore := store.NewMemStore()
		
		// Create a handler with the memory store
		handler := contacts.NewHandler(memStore)
		
		// Create a gin router
		r := gin.New()
		// Register the health endpoint
		r.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
		// Register the contacts handler
		handler.Register(r)
		
		// Test POST /contacts (create)
		body := strings.NewReader(`{"name":"Test User","email":"test@example.com"}`)
		req := httptest.NewRequest("POST", "/contacts", body)
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
		
		// Test GET /contacts (list)
		req = httptest.NewRequest("GET", "/contacts", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		
		// Test GET /contacts/{id} (get specific contact)
		req = httptest.NewRequest("GET", "/contacts/123", nil)
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
		// This should return 404 since we don't have a contact with id 123
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestMemStore(t *testing.T) {
	t.Run("Memory store operations", func(t *testing.T) {
		store := store.NewMemStore()
		
		// Test Create
		contact := store.Contact{
			Name:  "Test User",
			Email: "test@example.com",
		}
		created, err := store.Create(context.Background(), contact)
		assert.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, contact.Name, created.Name)
		assert.Equal(t, contact.Email, created.Email)

		// Test List
		listed, err := store.List(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listed, 1)
		assert.Equal(t, created.ID, listed[0].ID)
		assert.Equal(t, created.Name, listed[0].Name)
		assert.Equal(t, created.Email, listed[0].Email)
	})
}