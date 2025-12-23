package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/overleaf/chat-go/internal/store"
)

var msgStore = store.NewMemStore()

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GET /messages
func messagesListHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	msgs, err := msgStore.List(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "list failed"})
		return
	}
	_ = json.NewEncoder(w).Encode(msgs)
}

// POST /messages {"content":"...","author":"..."}
func messagesCreateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
		Author  string `json:"author"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}
	m := store.Message{Content: req.Content, Author: req.Author, CreatedAt: time.Now().Unix()}
	out, err := msgStore.Create(r.Context(), m)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "create failed"})
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(out)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/messages", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			messagesListHandler(w, r)
		case http.MethodPost:
			messagesCreateHandler(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
