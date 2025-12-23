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

// RegisterRoutes registers HTTP routes for the PoC
func RegisterRoutes(r *gin.Engine) {
	// metrics endpoint
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	r.GET("/health", healthHandler)

	// contacts handlers (in-memory PoC)
	contactsHandler := contacts.NewHandler(store.NewMemStore())
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
