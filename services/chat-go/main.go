package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/overleaf/chat-go/internal/logging"
	"github.com/overleaf/chat-go/internal/store"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

var msgStore = store.NewMemStore()
var logger *zap.Logger

var messagesColl *mongo.Collection
var roomsColl *mongo.Collection

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

// projectHandler routes project-scoped endpoints (threads, messages, threads list)
func projectHandler(w http.ResponseWriter, r *http.Request) {
	// path expected: /project/{projectId}/...
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 || parts[1] != "project" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	projectId := parts[2]
	// /project/{projectId}/thread/{threadId} (accept plural 'threads' for parity)
	if len(parts) >= 5 && (parts[3] == "thread" || parts[3] == "threads") {
		threadId := parts[4]
		// If requesting messages or thread
		if len(parts) == 5 && r.Method == http.MethodGet {
			// GET /project/{pid}/thread/{tid}
			handleGetThread(w, r, projectId, threadId)
			return
		}
		if len(parts) >= 6 && parts[5] == "messages" {
			if r.Method == http.MethodPost {
				// create message in thread
				handleCreateThreadMessage(w, r, projectId, threadId)
				return
			}
			if r.Method == http.MethodGet {
				// list messages in thread
				handleListThreadMessages(w, r, projectId, threadId)
				return
			}
		}
		// thread actions
		if len(parts) >= 6 {
			action := parts[5]
			if r.Method == http.MethodPost {
				switch action {
				case "resolve":
					// mark resolved
					var body struct {
						UserID string `json:"user_id"`
					}
					_ = json.NewDecoder(r.Body).Decode(&body)
					_ = msgStore // no-op for now
					w.WriteHeader(http.StatusNoContent)
					return
				case "reopen":
					w.WriteHeader(http.StatusNoContent)
					return
				case "delete":
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
		}
	}

	// /project/{projectId}/threads
	if len(parts) == 4 && parts[3] == "threads" && r.Method == http.MethodGet {
		handledThreadsList(w, r, projectId)
		return
	}

	// /project/{projectId}/messages (global for project)
	if len(parts) == 4 && parts[3] == "messages" {
		if r.Method == http.MethodGet {
			messagesListHandler(w, r)
			return
		}
		if r.Method == http.MethodPost {
			messagesCreateHandler(w, r)
			return
		}
	}

	w.WriteHeader(http.StatusNotFound)
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
	// support both global and thread-scoped POST paths
	// thread path: /project/{projectId}/thread/{threadId}/messages
	path := r.URL.Path
	if strings.Contains(path, "/project/") && strings.Contains(path, "/thread/") {
		parts := strings.Split(path, "/")
		if len(parts) >= 6 {
			projectId := parts[2]
			threadId := parts[4]
			var req struct {
				UserID  string `json:"user_id"`
				Content string `json:"content"`
				Author  string `json:"author"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				logger.Warn("invalid json", zap.Error(err))
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("invalid json"))
				return
			}
			// validation: content required
			if req.Content == "" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("No content provided"))
				return
			}
			// accept either user_id (preferred) or author for legacy test compatibility
			userID := req.UserID
			if userID == "" {
				userID = req.Author
			}
			// If user_id was provided, validate it strictly
			if req.UserID != "" && !isHex24(req.UserID) {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("Invalid userId"))
				return
			}
			if messagesColl != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				rooms := messagesColl.Database().Collection("rooms")
				projVal := interface{}(projectId)
				if pid, err := primitive.ObjectIDFromHex(projectId); err == nil {
					projVal = pid
				}
				tidVal := interface{}(threadId)
				if tid, err := primitive.ObjectIDFromHex(threadId); err == nil {
					tidVal = tid
				}
				var room map[string]interface{}
				if err := rooms.FindOne(ctx, map[string]interface{}{"project_id": projVal, "thread_id": tidVal}).Decode(&room); err != nil {
					// create room
					rdoc := map[string]interface{}{"project_id": projVal, "thread_id": tidVal}
					if rres, rerr := rooms.InsertOne(ctx, rdoc); rerr == nil {
						room = map[string]interface{}{"_id": rres.InsertedID}
					} else {
						logger.Error("rooms insert error", zap.Error(rerr))
						w.WriteHeader(http.StatusInternalServerError)
						return
					}
				}
				roomID := room["_id"]
				userVal := interface{}(req.UserID)
				if uid, err := primitive.ObjectIDFromHex(req.UserID); err == nil {
					userVal = uid
				}
				timestamp := time.Now().UnixMilli()
				doc := map[string]interface{}{"room_id": roomID, "content": req.Content, "user_id": userVal, "timestamp": timestamp}
				if r, err := messagesColl.InsertOne(ctx, doc); err == nil {
					id := ""
					if oid, ok := r.InsertedID.(primitive.ObjectID); ok {
						id = oid.Hex()
					}
					resp := map[string]interface{}{"id": id, "user_id": req.UserID, "content": req.Content, "timestamp": timestamp, "room_id": projectId}
					w.WriteHeader(http.StatusCreated)
					_ = json.NewEncoder(w).Encode(resp)
					return
				} else {
					logger.Error("messages insert error", zap.Error(err))
					w.WriteHeader(http.StatusInternalServerError)
					return
				}
			}
			m := store.Message{Content: req.Content, Author: req.UserID, CreatedAt: time.Now().Unix()}
			room, err := msgStore.FindOrCreateRoom(projectId, threadId)
			if err != nil {
				logger.Error("room lookup failed", zap.Error(err))
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			out, err := msgStore.CreateMessageInRoom(r.Context(), room.ID, m)
			if err != nil {
				logger.Error("create failed", zap.Error(err))
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			// format response to match Node
			resp := map[string]interface{}{
				"id":        out.ID,
				"user_id":   out.Author,
				"content":   out.Content,
				"timestamp": out.CreatedAt,
				"room_id":   projectId,
			}
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
	}

	// fallback: global message create
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

// helper: check hex 24
func isHex24(s string) bool {
	if len(s) != 24 {
		return false
	}
	for _, c := range s {
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			continue
		}
		return false
	}
	return true
}

func handleGetThread(w http.ResponseWriter, r *http.Request, projectId, threadId string) {
	w.Header().Set("Content-Type", "application/json")
	// If Mongo is configured, prefer DB-backed lookup
	if messagesColl != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		rooms := messagesColl.Database().Collection("rooms")
		projVal := interface{}(projectId)
		if pid, err := primitive.ObjectIDFromHex(projectId); err == nil {
			projVal = pid
		}
		tidVal := interface{}(threadId)
		if tid, err := primitive.ObjectIDFromHex(threadId); err == nil {
			tidVal = tid
		}
		var room map[string]interface{}
		if err := rooms.FindOne(ctx, map[string]interface{}{"project_id": projVal, "thread_id": tidVal}).Decode(&room); err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		cur, err := messagesColl.Find(ctx, map[string]interface{}{"room_id": room["_id"]})
		if err != nil {
			logger.Error("messages find failed", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		var raw []map[string]interface{}
		if err := cur.All(ctx, &raw); err != nil {
			logger.Error("cursor all failed", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		out := []map[string]interface{}{}
		for _, d := range raw {
			id := ""
			if oid, ok := d["_id"].(primitive.ObjectID); ok {
				id = oid.Hex()
			} else if s, ok := d["_id"].(string); ok {
				id = s
			}
			user := ""
			if uid, ok := d["user_id"].(primitive.ObjectID); ok {
				user = uid.Hex()
			} else if s, ok := d["user_id"].(string); ok {
				user = s
			}
			// timestamp may be int64 or float64
			ts := int64(0)
			switch v := d["timestamp"].(type) {
			case int64:
				ts = v
			case float64:
				ts = int64(v)
			case int:
				ts = int64(v)
			}
			out = append(out, map[string]interface{}{
				"id":        id,
				"user_id":   user,
				"content":   d["content"],
				"timestamp": ts,
			})
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"messages": out})
		return
	}

	// fallback to in-memory store
	room, err := msgStore.FindRoom(projectId, threadId)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	msgs, err := msgStore.ListMessagesInRoom(r.Context(), room.ID)
	if err != nil {
		logger.Error("list failed", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	out := []map[string]interface{}{}
	for _, m := range msgs {
		out = append(out, map[string]interface{}{
			"id":        m.ID,
			"user_id":   m.Author,
			"content":   m.Content,
			"timestamp": m.CreatedAt,
		})
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"messages": out})
}

func handleListThreadMessages(w http.ResponseWriter, r *http.Request, projectId, threadId string) {
	w.Header().Set("Content-Type", "application/json")
	room, err := msgStore.FindRoom(projectId, threadId)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	msgs, err := msgStore.ListMessagesInRoom(r.Context(), room.ID)
	if err != nil {
		logger.Error("list failed", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	out := []map[string]interface{}{}
	for _, m := range msgs {
		out = append(out, map[string]interface{}{
			"id":        m.ID,
			"user_id":   m.Author,
			"content":   m.Content,
			"timestamp": m.CreatedAt,
		})
	}
	_ = json.NewEncoder(w).Encode(out)
}

func handleCreateThreadMessage(w http.ResponseWriter, r *http.Request, projectId, threadId string) {
	// delegate to messagesCreateHandler path handling
	req := r
	req.URL.Path = "/project/" + projectId + "/thread/" + threadId + "/messages"
	messagesCreateHandler(w, req)
}

// handledThreadsList mirrors Node: only include threads that have messages
func handledThreadsList(w http.ResponseWriter, r *http.Request, projectId string) {
	w.Header().Set("Content-Type", "application/json")
	rooms, err := msgStore.ListThreads(projectId)
	if err != nil {
		logger.Error("list threads failed", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	threads := map[string]map[string]interface{}{}
	for _, room := range rooms {
		msgs, _ := msgStore.ListMessagesInRoom(r.Context(), room.ID)
		if len(msgs) == 0 {
			continue
		}
		ms := []map[string]interface{}{}
		for _, m := range msgs {
			ms = append(ms, map[string]interface{}{
				"id":        m.ID,
				"user_id":   m.Author,
				"content":   m.Content,
				"timestamp": m.CreatedAt,
			})
		}
		threads[room.ThreadID] = map[string]interface{}{"messages": ms}
	}
	_ = json.NewEncoder(w).Encode(threads)
}

// helper used by tests to hit GET /project/{projectId}/thread/{threadId}
func threadsHandlerWithDefaultStore(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) >= 5 {
		projectId := parts[2]
		threadId := parts[4]
		handleGetThread(w, r, projectId, threadId)
		return
	}
	w.WriteHeader(http.StatusNotFound)
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

	// Optional MongoDB initialization (for parity testing with seeded DB)
	if uri := os.Getenv("MONGO_URI"); uri != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		clientOpts := options.Client().ApplyURI(uri)
		client, err := mongo.Connect(ctx, clientOpts)
		if err != nil {
			logger.Warn("mongo connect error", zap.Error(err))
		} else {
			if err := client.Ping(ctx, nil); err != nil {
				logger.Warn("mongo ping failed", zap.Error(err))
			} else {
				// Use DB name from URI path if present
				dbName := "chat"
				if u, perr := url.Parse(uri); perr == nil {
					if p := strings.Trim(u.Path, "/"); p != "" {
						dbName = p
					}
				}
				messagesColl = client.Database(dbName).Collection("messages")
				roomsColl = client.Database(dbName).Collection("rooms")
				logger.Info("connected to Mongo", zap.String("uri", uri), zap.String("db", dbName))
			}
		}
	}

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

	// project-scoped handler (threads / messages)
	http.HandleFunc("/project/", instrumentHandler("/project", projectHandler))

	// metrics endpoint
	http.Handle("/metrics", promhttp.Handler())

	logger.Info("listening", zap.String("addr", addr))
	if err := http.ListenAndServe(addr, nil); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
