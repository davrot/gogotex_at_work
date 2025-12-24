package main

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/overleaf/chat-go/internal/store"
	"github.com/overleaf/chat-go/internal/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

var msgStore = store.NewMemStore()
var logger *zap.Logger

var (
	httpRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "chat_http_requests_total",
		Help: "Total number of HTTP requests",
	}, []string{"method", "path", "code"})

	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "chat_http_request_duration_seconds",
		Help:    "HTTP request duration (seconds)",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// instrumentHandler wraps an http.HandlerFunc to collect Prometheus metrics and log requests
func instrumentHandler(path string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		// use a ResponseWriter wrapper to capture status code
		rw := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		h(rw, r)
		dur := time.Since(start).Seconds()
		requestDuration.WithLabelValues(r.Method, path).Observe(dur)
		httpRequests.WithLabelValues(r.Method, path, http.StatusText(rw.statusCode)).Inc()
		logger.Info("request",
			zap.String("method", r.Method),
			zap.String("path", path),
			zap.Int("status", rw.statusCode),
			zap.Float64("dur_s", dur),
		)
	}
}

// statusRecorder captures response status codes
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

// GET /messages
func messagesListHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	msgs, err := msgStore.List(r.Context())
	if err != nil {
		logger.Error("list failed", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "list failed"})
		return
	}
	_ = json.NewEncoder(w).Encode(msgs)
}

// POST /messages {"content":"...","author":"..."}
func messagesCreateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
		Author  string `json:"author"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Warn("invalid json", zap.Error(err))
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}
	m := store.Message{Content: req.Content, Author: req.Author, CreatedAt: time.Now().Unix()}
	out, err := msgStore.Create(r.Context(), m)
	if err != nil {
		logger.Error("create failed", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "create failed"})
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(out)
}

func main() {
	// init logger (centralized)
	var err error
	logger, err = logging.Init(os.Getenv("DEV_LOG") == "1")
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	// instrumented handlers
	http.HandleFunc("/health", instrumentHandler("/health", healthHandler))
	http.HandleFunc("/messages", instrumentHandler("/messages", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			messagesListHandler(w, r)
		case http.MethodPost:
			messagesCreateHandler(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	// metrics endpoint
	http.Handle("/metrics", promhttp.Handler())

	logger.Info("listening", zap.String("addr", addr))
	if err := http.ListenAndServe(addr, nil); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
