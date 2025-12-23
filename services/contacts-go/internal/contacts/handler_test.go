package contacts

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestContactsListCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := store.NewMemStore()
	h := NewHandler(s)
	h.Register(r)

	// list should be empty
	req := httptest.NewRequest(http.MethodGet, "/contacts", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "[]", w.Body.String())

	// create
	createReq := httptest.NewRequest(http.MethodPost, "/contacts", strings.NewReader(`{"name":"Alice","email":"a@e.com"}`))
	createReq.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, createReq)
	assert.Equal(t, http.StatusCreated, w2.Code)

	// list should include one entry
	req3 := httptest.NewRequest(http.MethodGet, "/contacts", nil)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusOK, w3.Code)
	assert.Contains(t, w3.Body.String(), "Alice")

	// invalid create should return 400 for malformed JSON
	badReq := httptest.NewRequest(http.MethodPost, "/contacts", strings.NewReader(`{name:"oops"}`))
	badReq.Header.Set("Content-Type", "application/json")
	wb := httptest.NewRecorder()
	r.ServeHTTP(wb, badReq)
	assert.Equal(t, http.StatusBadRequest, wb.Code)
	assert.Contains(t, wb.Body.String(), "invalid JSON")

	// missing fields should return 400
	missingReq := httptest.NewRequest(http.MethodPost, "/contacts", strings.NewReader(`{"name":""}`))
	missingReq.Header.Set("Content-Type", "application/json")
	wm := httptest.NewRecorder()
	r.ServeHTTP(wm, missingReq)
	assert.Equal(t, http.StatusBadRequest, wm.Code)
	assert.Contains(t, wm.Body.String(), "name and email are required")
}
