// Package server wires up HTTP routes used by the PoC server.
package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/contacts"
	"github.com/overleaf/contacts-go/internal/logging"
	"github.com/overleaf/contacts-go/internal/metrics"
	"github.com/overleaf/contacts-go/internal/store"
)

// RegisterRoutes registers HTTP routes for the PoC (default uses in-memory store)
func RegisterRoutes(r *gin.Engine) {
	RegisterWithStore(r, store.NewMemStore())
}

// RegisterWithStore registers routes using the provided Store implementation.
func RegisterWithStore(r *gin.Engine, s store.Store) {
	// metrics endpoint
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	r.GET("/health", healthHandler)

	// contacts handlers (store provided)
	contactsHandler := contacts.NewHandler(s)
	contactsHandler.Register(r)
	// future: register other handlers or middleware here
}

func healthHandler(c *gin.Context) {
	// simple metric for health check invocations
	metrics.HealthChecks.Inc()
	if logging.Logger != nil {
		logging.Logger.Info("health check")
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
