package messages

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/pkg/errors"

	"github.com/overleaf/real-time-go/internal/store"
)

// Handler handles HTTP requests for messages.
type Handler struct {
	store store.Store
}

func NewHandler(s store.Store) *Handler { return &Handler{store: s} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/messages", h.messages)
}

func (h *Handler) messages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.publish(w, r)
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

func (h *Handler) publish(w http.ResponseWriter, r *http.Request) {
	var m store.Message
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}
	if m.Channel == "" || m.Body == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "channel and body required"})
		return
	}
	ctx := r.Context()
	out, err := h.store.Publish(ctx, m)
	if err != nil {
		h.writeErr(w, errors.Wrap(err, "publish"))
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
