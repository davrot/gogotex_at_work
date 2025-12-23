package documents

import (
"context"
"encoding/json"
"log"
"net/http"

"github.com/pkg/errors"

"github.com/overleaf/docstore-go/internal/store"
)

// Handler handles HTTP requests for documents.
type Handler struct {
store store.Store
}

// NewHandler creates a new documents handler.
func NewHandler(s store.Store) *Handler { return &Handler{store: s} }

// Register wires routes onto the mux.
func (h *Handler) Register(mux *http.ServeMux) {
mux.HandleFunc("/documents", h.documents)
}

func (h *Handler) documents(w http.ResponseWriter, r *http.Request) {
switch r.Method {
case http.MethodGet:
h.list(w, r)
case http.MethodPost:
h.create(w, r)
default:
w.WriteHeader(http.StatusMethodNotAllowed)
}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
ctx := r.Context()
out, err := h.store.List(ctx)
if err != nil {
h.writeErr(w, errors.Wrap(err, "list"))
return
}
w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
var d store.Document
if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
w.WriteHeader(http.StatusBadRequest)
_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
return
}
if d.Title == "" {
w.WriteHeader(http.StatusBadRequest)
_ = json.NewEncoder(w).Encode(map[string]string{"error": "title required"})
return
}
ctx := r.Context()
out, err := h.store.Create(ctx, d)
if err != nil {
h.writeErr(w, errors.Wrap(err, "create"))
return
}
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
_ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
log.Printf("handler error: %v", err)
w.WriteHeader(http.StatusInternalServerError)
_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal"})
}
