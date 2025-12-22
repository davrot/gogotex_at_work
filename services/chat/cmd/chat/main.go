package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
)

func statusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode("chat is alive")
}

// threadsHandler handles GET /project/{projectId}/threads and returns a simple
// threads list (read-only, minimal response for parity testing).
func threadsHandlerWithStore(s *store.Store, w http.ResponseWriter, r *http.Request) {
	// Expect path: /project/{projectId}/threads
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 || parts[1] != "project" || parts[3] != "threads" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	projectId := parts[2]

	// check for seeded threads in the in-memory store
	key := "threads:" + projectId
	if val, ok := s.Get(key); ok {
		var out []interface{}
		if err := json.Unmarshal([]byte(val), &out); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(out)
			return
		}
	}

	// default empty list
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode([]interface{}{})
}

func main() {
	// Optional seeding for tests: JSON map of projectId -> []threadIDs
	seed := os.Getenv("SEED_THREADS")
	s := store.New()
	if seed != "" {
		var decoded map[string][]string
		if err := json.Unmarshal([]byte(seed), &decoded); err != nil {
			log.Printf("invalid SEED_THREADS: %v", err)
		} else {
			for pid, threads := range decoded {
				b, _ := json.Marshal(threads)
				s.Put("threads:"+pid, string(b))
			}
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3011"
	}
	addr := ":" + port
	mux := http.NewServeMux()
	mux.HandleFunc("/status", statusHandler)
	mux.HandleFunc("/project/", func(w http.ResponseWriter, r *http.Request) {
		// inject store into closure for handlers
		threadsHandlerWithStore(s, w, r)
	})

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
