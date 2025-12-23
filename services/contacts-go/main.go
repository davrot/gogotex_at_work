// Package main is the entrypoint for the contacts PoC service.
package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/config"
	"github.com/overleaf/contacts-go/internal/logging"
	"github.com/overleaf/contacts-go/internal/metrics"
	"github.com/overleaf/contacts-go/internal/middleware"
	"github.com/overleaf/contacts-go/internal/server"
	"github.com/overleaf/contacts-go/internal/store"
)

func main() {
	// Initialize structured logger
	if err := logging.Init(); err != nil {
		log.Fatalf("failed to initialize logger: %v", err)
	}
	defer logging.Sync()

	// Initialize metrics
	metrics.Init()

	r := gin.New()
	// Attach request logging middleware globally
	r.Use(middleware.RequestLogger())

	// Choose store implementation via env STORE ("mem" or "postgres")	
	storeType := os.Getenv("STORE")
	var s store.Store
	if storeType == "postgres" {
		dsn := os.Getenv("DATABASE_URL")
		if dsn == "" {
			log.Fatalf("STORE=postgres but DATABASE_URL not set")
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			log.Fatalf("open db: %v", err)
		}
		ps, err := store.NewPostgresStore(db)
		if err != nil {
			log.Fatalf("init postgres store: %v", err)
		}
		s = ps
	} else {
		s = store.NewMemStore()
	}

	server.RegisterWithStore(r, s)

	addr := ":" + config.Port()
	if err := r.Run(addr); err != nil {
		logging.Logger.Sugar().Fatalf("server exit: %v", err)
	}
}
