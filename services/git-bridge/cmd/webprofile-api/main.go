package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoURI = getEnv("MONGO_URI", "mongodb://mongo:27017/sharelatex")
	collName = "usersshkeys"
)

func getEnv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

type SSHKey struct {
	ID         interface{} `bson:"_id,omitempty" json:"id"`
	KeyName    string      `bson:"keyName,omitempty" json:"key_name"`
	Label      string      `bson:"label,omitempty" json:"label"`
	PublicKey  string      `bson:"publicKey,omitempty" json:"public_key"`
	Fingerprint string     `bson:"fingerprint,omitempty" json:"fingerprint"`
	CreatedAt  time.Time   `bson:"createdAt,omitempty" json:"created_at"`
	UpdatedAt  time.Time   `bson:"updatedAt,omitempty" json:"updated_at"`
	UserID     interface{} `bson:"userId,omitempty" json:"userId"`
}

func computeFingerprint(publicKey string) string {
	h := sha256.Sum256([]byte(publicKey))
	enc := base64.StdEncoding.EncodeToString(h[:])
	return "SHA256:" + enc
}

func main() {
	ctx := context.Background()
	clientOpts := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer client.Disconnect(ctx)

	coll := client.Database("sharelatex").Collection(collName)
	// Ensure unique index on fingerprint for idempotency
	go ensureIndex(ctx, coll)

	r := mux.NewRouter()
	r.HandleFunc("/internal/api/users/{userId}/ssh-keys", func(w http.ResponseWriter, r *http.Request) {
		listHandler(ctx, w, r, coll)
	}).Methods("GET")

	r.HandleFunc("/internal/api/users/{userId}/ssh-keys", func(w http.ResponseWriter, r *http.Request) {
		createHandler(ctx, w, r, coll)
	}).Methods("POST")

	srv := &http.Server{Addr: ":3900", Handler: r}
	log.Printf("webprofile-api listening on %s (mongo=%s)", srv.Addr, mongoURI)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("http serve: %v", err)
	}
}

func ensureIndex(ctx context.Context, coll *mongo.Collection) {
	idx := mongo.IndexModel{Keys: bson.D{{Key: "fingerprint", Value: 1}}, Options: options.Index().SetUnique(true)}
	_, err := coll.Indexes().CreateOne(ctx, idx)
	if err != nil {
		log.Printf("ensureIndex: %v", err)
	} else {
		log.Printf("ensured unique index on fingerprint")
	}
}

func listHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, coll *mongo.Collection) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	filter := bson.M{"userId": userId}

	cur, err := coll.Find(ctx, filter)
	if err != nil {
		http.Error(w, fmt.Sprintf("find error: %v", err), http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	out := []SSHKey{}
	for cur.Next(ctx) {
		var s SSHKey
		if err := cur.Decode(&s); err != nil {
			log.Printf("decode err: %v", err)
			continue
		}
		out = append(out, s)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func createHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, coll *mongo.Collection) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	var req struct {
		PublicKey string `json:"public_key"`
		KeyName   string `json:"key_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.PublicKey == "" {
		http.Error(w, "public_key required", http.StatusBadRequest)
		return
	}
	fingerprint := computeFingerprint(req.PublicKey)
	now := time.Now()
	filter := bson.M{"fingerprint": fingerprint}
	update := bson.M{"$setOnInsert": bson.M{"userId": userId, "keyName": req.KeyName, "publicKey": req.PublicKey, "createdAt": now}, "$set": bson.M{"updatedAt": now}}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)

	res := coll.FindOneAndUpdate(ctx, filter, update, opts)
	var doc SSHKey
	if err := res.Decode(&doc); err != nil {
		// If decode fails, attempt a fetch (fallback)
		// This mirrors the Node fallback behaviour for driver visibility quirk
		fetch := coll.FindOne(ctx, filter)
		if fetchErr := fetch.Decode(&doc); fetchErr != nil {
			log.Printf("upsert no doc and fetch failed: upsertErr=%v fetchErr=%v", err, fetchErr)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	createdNow := (time.Since(doc.CreatedAt) < 5*time.Second)
	if createdNow {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         doc.ID,
		"key_name":   doc.KeyName,
		"label":      doc.Label,
		"public_key": doc.PublicKey,
		"fingerprint": doc.Fingerprint,
		"created_at": doc.CreatedAt,
		"updated_at": doc.UpdatedAt,
		"userId":     doc.UserID,
	})
}
