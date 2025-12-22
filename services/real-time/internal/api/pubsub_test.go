package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublishHandler_OK(t *testing.T) {
	body := bytes.NewBufferString(`{"topic":"news","msg":"hello"}`)
	req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", body)
	r := httptest.NewRecorder()
	PublishHandler(r, req)
	if r.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", r.Code)
	}
}

func TestPublishHandler_BadJSON(t *testing.T) {
	body := bytes.NewBufferString(`{invalid`)
	req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", body)
	r := httptest.NewRecorder()
	PublishHandler(r, req)
	if r.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", r.Code)
	}
}

func TestPublishHandler_NoTopic(t *testing.T) {
	body := bytes.NewBufferString(`{"msg":"hi"}`)
	req := httptest.NewRequest("POST", "/internal/api/pubsub/publish", body)
	r := httptest.NewRecorder()
	PublishHandler(r, req)
	if r.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", r.Code)
	}
}
