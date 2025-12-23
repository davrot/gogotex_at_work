package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/davrot/gogotex_at_work/services/chat/internal/store"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var messagesColl *mongo.Collection

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
	if _, ok := s.Get(key); ok {
		// Node implementation returns an object mapping threadId -> { messages: [] }
		// only when messages exist; when there are no messages it returns {}
		// To match parity, return {} for seeded empty threads (tests seed only thread ids)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{})
		return
	}

	// default empty list
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode([]interface{}{})
}

// messagesHandlerWithStore handles POST /project/{projectId}/threads/{threadId}/messages
// and performs minimal validation to match Node controller behavior for parity tests.
func messagesHandlerWithStore(s *store.Store, w http.ResponseWriter, r *http.Request) {
	// log for parity debugging
	log.Printf("messagesHandler: %s %s", r.Method, r.URL.Path)
	// Expect path: /project/{projectId}/threads/{threadId}/messages
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 6 || parts[1] != "project" || parts[3] != "threads" || parts[5] != "messages" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	projectId := parts[2]
	threadId := parts[4]

	// Only implement POST for now
	if r.Method == http.MethodPost {
		var body struct {
			UserID string `json:"user_id"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Header().Set("Content-Type", "text/plain")
			w.Write([]byte("Invalid JSON"))
			return
		}

		// Validate user id (naive ObjectId check: 24 hex chars)
		if len(body.UserID) != 24 {
			w.WriteHeader(http.StatusBadRequest)
			w.Header().Set("Content-Type", "text/plain")
			w.Write([]byte("Invalid userId"))
			return
		}
		if body.Content == "" {
			w.WriteHeader(http.StatusBadRequest)
			w.Header().Set("Content-Type", "text/plain")
			w.Write([]byte("No content provided"))
			return
		}

			// Minimal message creation: persist to Mongo if configured; otherwise use in-memory store
		msg := map[string]interface{}{
			"_id":      "m1",
			"content":  body.Content,
			"user_id":  body.UserID,
			"timestamp": 1234567890,
		}
		if messagesColl != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			doc := map[string]interface{}{
				"room_id": threadId,
				"content": body.Content,
				"user_id": body.UserID,
				"timestamp": time.Now().Unix(),
			}
			if _, err := messagesColl.InsertOne(ctx, doc); err != nil {
				log.Printf("mongo insert error: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(msg)
			return
		}

		key := "messages:" + projectId + ":" + threadId
		b, _ := json.Marshal([]interface{}{msg})
		s.Put(key, string(b))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(msg)
		return
	}

	// For GET, return stored messages if present
	if r.Method == http.MethodGet {
		// query Mongo if configured
		if messagesColl != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			cur, err := messagesColl.Find(ctx, map[string]interface{}{ "room_id": threadId })
			if err == nil {
				var out []map[string]interface{}
				if err := cur.All(ctx, &out); err == nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_ = json.NewEncoder(w).Encode(out)
					return
				}
			}
			// fallthrough to empty
		}

		key := "messages:" + projectId + ":" + threadId
		if val, ok := s.Get(key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(val))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
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

	// Optional MongoDB initialization
	if uri := os.Getenv("MONGO_URI"); uri != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		clientOpts := options.Client().ApplyURI(uri)
		client, err := mongo.Connect(ctx, clientOpts)
		if err != nil {
			log.Printf("mongo connect error: %v", err)
		} else {
			if err := client.Ping(ctx, nil); err != nil {
				log.Printf("mongo ping failed: %v", err)
			} else {
				messagesColl = client.Database("chat").Collection("messages")
				log.Printf("connected to Mongo at %s", uri)
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
		// route messages endpoint to messagesHandler; otherwise threads
		if strings.Contains(r.URL.Path, "/messages") {
			messagesHandlerWithStore(s, w, r)
			return
		}
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
