package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/overleaf/docstore-go/internal/documents"
	"github.com/overleaf/docstore-go/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	s := store.NewMemStore()
	h := documents.NewHandler(s)
	h.Register(mux)

	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
