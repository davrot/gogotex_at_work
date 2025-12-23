package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/logging"
	"github.com/overleaf/contacts-go/internal/metrics"
	"github.com/overleaf/contacts-go/internal/middleware"
	"github.com/overleaf/contacts-go/internal/server"
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
	server.RegisterRoutes(r)

	if err := r.Run(); err != nil {
		logging.Logger.Sugar().Fatalf("server exit: %v", err)
	}
}
