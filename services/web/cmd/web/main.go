package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/davrot/gogotex_at_work/services/web/internal/api"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	// Minimal introspect endpoint for parity & testing
	http.HandleFunc("/internal/api/tokens/introspect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		api.IntrospectHandler(w, r)
	})

	addr := ":3000"
	log.Printf("web-go-shim listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
