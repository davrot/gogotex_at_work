package documents

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/overleaf/docstore-go/internal/store"
)

func setupHandler() (*Handler, *httptest.Server) {
	s := store.NewMemStore()
	h := NewHandler(s)
	mux := http.NewServeMux()
	h.Register(mux)
	return h, httptest.NewServer(mux)
}

func TestListEmpty(t *testing.T) {
	h, ts := setupHandler()
	_ = h
	defer ts.Close()

	res, err := http.Get(ts.URL + "/documents")
	assert.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)
	var arr []store.Document
	assert.NoError(t, json.NewDecoder(res.Body).Decode(&arr))
	assert.Len(t, arr, 0)
}

func TestCreateAndList(t *testing.T) {
	h, ts := setupHandler()
	_ = h
	defer ts.Close()

	body := map[string]string{"title": "Doc 1", "body": "hello"}
	b, _ := json.Marshal(body)
	res, err := http.Post(ts.URL+"/documents", "application/json", bytes.NewReader(b))
	assert.NoError(t, err)
	assert.Equal(t, 201, res.StatusCode)

	var created store.Document
	assert.NoError(t, json.NewDecoder(res.Body).Decode(&created))
	assert.NotEmpty(t, created.ID)

	res2, err := http.Get(ts.URL + "/documents")
	assert.NoError(t, err)
	var arr []store.Document
	assert.NoError(t, json.NewDecoder(res2.Body).Decode(&arr))
	assert.Len(t, arr, 1)
	assert.Equal(t, created.ID, arr[0].ID)
}

func TestCreateValidation(t *testing.T) {
	h, ts := setupHandler()
	_ = h
	defer ts.Close()

	body := map[string]string{"body": "no title"}
	b, _ := json.Marshal(body)
	res, err := http.Post(ts.URL+"/documents", "application/json", bytes.NewReader(b))
	assert.NoError(t, err)
	assert.Equal(t, 400, res.StatusCode)
}
