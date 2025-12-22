package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/davrot/gogotex_at_work/services/real_time/internal/api"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	// Minimal API endpoints for parity tests
	http.HandleFunc("/internal/api/pubsub/publish", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		api.PublishHandler(w, r)
	})

	addr := ":3000"
	log.Printf("real-time service listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
