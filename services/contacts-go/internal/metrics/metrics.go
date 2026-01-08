// Package metrics provides Prometheus metrics for the service.
package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// HealthChecks counts the number of health checks performed.
var HealthChecks = prometheus.NewCounter(prometheus.CounterOpts{
	Name: "contacts_health_checks_total",
	Help: "Total health checks",
})

// RequestDuration measures request durations.
var RequestDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
	Name:    "contacts_request_duration_seconds",
	Help:    "Histogram of request durations in seconds",
	Buckets: prometheus.DefBuckets,
})

// Init registers metrics with the default Prometheus registry.
func Init() {
	prometheus.MustRegister(HealthChecks)
	prometheus.MustRegister(RequestDuration)
}

// Handler returns an HTTP handler exposing the registered metrics.
func Handler() http.Handler {
	return promhttp.Handler()
}
