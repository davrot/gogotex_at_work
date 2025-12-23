package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
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
	var sstore store.Store
	if os.Getenv("STORE") == "postgres" {
		dsn := os.Getenv("DATABASE_URL")
		if dsn == "" {
			log.Fatal("DATABASE_URL required when STORE=postgres")
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			log.Fatalf("open db: %v", err)
		}
		ps, err := store.NewPostgresStore(db)
		if err != nil {
			log.Fatalf("NewPostgresStore: %v", err)
		}
		sstore = ps
	} else {
		sstore = store.NewMemStore()
	}
	h := documents.NewHandler(sstore)
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
