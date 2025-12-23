package notifications

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/pkg/errors"

	"github.com/overleaf/notifications-go/internal/store"
)

// Handler handles HTTP requests for notifications.
type Handler struct {
	store store.Store
}

func NewHandler(s store.Store) *Handler { return &Handler{store: s} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/notifications", h.notifications)
}

func (h *Handler) notifications(w http.ResponseWriter, r *http.Request) {
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
	var n store.Notification
	if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}
	if n.Recipient == "" || n.Message == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "recipient and message required"})
		return
	}
	ctx := r.Context()
	out, err := h.store.Create(ctx, n)
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
