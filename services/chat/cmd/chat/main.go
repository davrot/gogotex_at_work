package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

func statusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode("chat is alive")
}

// threadsHandler handles GET /project/{projectId}/threads and returns a simple
// threads list (read-only, minimal response for parity testing).
func threadsHandler(w http.ResponseWriter, r *http.Request) {
	// Expect path: /project/{projectId}/threads
	// Simple, permissive parsing for the spike: split path components.
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 || parts[1] != "project" || parts[3] != "threads" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	projectId := parts[2]
	_ = projectId // not used in spike; real implementation would query DB

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode([]interface{}{})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3011"
	}
	addr := ":" + port
	mux := http.NewServeMux()
	mux.HandleFunc("/status", statusHandler)
	mux.HandleFunc("/project/", threadsHandler)

	// simple readiness endpoint for health checks
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	log.Printf("chat service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
