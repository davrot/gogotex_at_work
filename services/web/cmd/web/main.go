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

	// Minimal token create endpoint for parity & testing
	http.HandleFunc("/internal/api/users/", func(w http.ResponseWriter, r *http.Request) {
		// naive path prefix handler: only support POST for /internal/api/users/:userId/git-tokens
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		// ensure path ends with /git-tokens
		if len(r.URL.Path) < 1 || r.URL.Path[len(r.URL.Path)-10:] != "/git-tokens" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		api.CreateTokenHandler(w, r)
	})

	addr := ":3000"
	log.Printf("web-go-shim listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
