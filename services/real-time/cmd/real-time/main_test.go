package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)

	res := w.Result()
	assert.Equal(t, http.StatusOK, res.StatusCode)

	var response map[string]interface{}
	err := json.NewDecoder(res.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
}

func TestPublishHandler(t *testing.T) {
	// Test valid publish request
	t.Run("Valid publish request", func(t *testing.T) {
		body := `{"topic":"test-topic","msg":"test-message"}`
		req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		publishHandler(w, req)
		
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.NewDecoder(w.Body).Decode(&response)
		assert.NoError(t, err)
		assert.Equal(t, true, response["ok"])
		assert.Equal(t, "test-topic", response["topic"])
	})

	// Test invalid JSON
	t.Run("Invalid JSON", func(t *testing.T) {
		body := `{"topic":}`
		req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		publishHandler(w, req)
		
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	// Test missing topic
	t.Run("Missing topic", func(t *testing.T) {
		body := `{"msg":"test-message"}`
		req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		publishHandler(w, req)
		
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	// Test method not allowed
	t.Run("Method not allowed", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/internal/api/pubsub/publish", nil)
		w := httptest.NewRecorder()
		publishHandler(w, req)
		
		assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
	})
}

func TestRealTimeEndpoints(t *testing.T) {
	// Test health endpoint
	t.Run("Health endpoint", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		healthHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		
		var response map[string]interface{}
		err := json.NewDecoder(w.Body).Decode(&response)
		assert.NoError(t, err)
		assert.Equal(t, "ok", response["status"])
	})

	// Test publish endpoint
	t.Run("Publish endpoint", func(t *testing.T) {
		body := `{"topic":"test-topic","msg":"test-message"}`
		req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		publishHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	// Test with timeout to prevent hanging
	t.Run("Endpoints with timeout", func(t *testing.T) {
		// Create a context with timeout to prevent hanging
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Test health endpoint with timeout
		req := httptest.NewRequest("GET", "/health", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		healthHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		
		// Test publish endpoint with timeout
		body := `{"topic":"test-topic","msg":"test-message"}`
		req = httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(ctx)
		w = httptest.NewRecorder()
		publishHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestRealTimeService(t *testing.T) {
	// Test that the service starts correctly
	t.Run("Service startup", func(t *testing.T) {
		// Since this is a simple service, we can at least verify
		// that the service structure is correct
		assert.NotNil(t, healthHandler)
		assert.NotNil(t, publishHandler)
	})

	// Test that all expected endpoints are handled
	t.Run("Endpoint handling", func(t *testing.T) {
		// Test health endpoint
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		healthHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		
		// Verify response content
		var response map[string]interface{}
		err := json.NewDecoder(w.Body).Decode(&response)
		assert.NoError(t, err)
		assert.Equal(t, "ok", response["status"])
		
		// Test publish endpoint
		body := `{"topic":"test-topic","msg":"test-message"}`
		req = httptest.NewRequest("POST", "/internal/api/pubsub/publish", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		publishHandler(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}