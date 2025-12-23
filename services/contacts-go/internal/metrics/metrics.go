package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var HealthChecks = prometheus.NewCounter(prometheus.CounterOpts{
	Name: "contacts_health_checks_total",
	Help: "Total health checks",
})

var RequestDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
	Name:    "contacts_request_duration_seconds",
	Help:    "Histogram of request durations in seconds",
	Buckets: prometheus.DefBuckets,
})

func Init() {
	prometheus.MustRegister(HealthChecks)
	prometheus.MustRegister(RequestDuration)
}

func Handler() http.Handler {
	return promhttp.Handler()
}
