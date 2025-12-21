package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"crypto/rand"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/pbkdf2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
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

// requireAuth enforces a simple Basic auth check for parity with the Node web service.
// In dev/CI the default credentials are overleaf:overleaf; these can be overridden with
// WEBPROFILE_ADMIN_USER and WEBPROFILE_ADMIN_PASS env vars.
func requireAuth(w http.ResponseWriter, r *http.Request) bool {
	adminUser := getEnv("WEBPROFILE_ADMIN_USER", "overleaf")
	adminPass := getEnv("WEBPROFILE_ADMIN_PASS", "overleaf")
	user, pass, ok := r.BasicAuth()
	if ok && user == adminUser && pass == adminPass {
		return true
	}
	// Fallback: if X-Service-Origin header present, allow (internal service calls)
	if r.Header.Get("X-Service-Origin") != "" {
		return true
	}
	// Mirror Node behaviour: unauthenticated requests are redirected to login (302)
	w.Header().Set("Location", "/auth/login")
	w.WriteHeader(http.StatusFound)
	w.Write([]byte("redirect"))
	return false
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
		if !requireAuth(w, r) { return }
		listHandler(ctx, w, r, coll)
	}).Methods("GET")

	r.HandleFunc("/internal/api/users/{userId}/ssh-keys", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		createHandler(ctx, w, r, coll)
	}).Methods("POST")

	r.HandleFunc("/internal/api/users/{userId}/ssh-keys/{keyId}", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		deleteHandler(ctx, w, r, coll)
	}).Methods("DELETE")

	// token introspection (private API) — expect JSON { token }
	r.HandleFunc("/internal/api/tokens/introspect", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		tokenIntrospectHandler(ctx, w, r, client)
	}).Methods("POST")

	// Token management endpoints (create/list/revoke) for git tokens
	r.HandleFunc("/internal/api/users/{userId}/git-tokens", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		tokenCreateHandler(ctx, w, r, client)
	}).Methods("POST")

	r.HandleFunc("/internal/api/users/{userId}/git-tokens", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		tokenListHandler(ctx, w, r, client)
	}).Methods("GET")

	r.HandleFunc("/internal/api/users/{userId}/git-tokens/{tokenId}", func(w http.ResponseWriter, r *http.Request) {
		if !requireAuth(w, r) { return }
		tokenRevokeHandler(ctx, w, r, client)
	}).Methods("DELETE")

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

// tokenIntrospectHandler implements a provider-agnostic token introspection
// endpoint. It checks the `personalaccesstokens` collection for candidates
// matching the hashPrefix and verifies the supplied token using the stored
// algorithm (argon2id, bcrypt or pbkdf2 fallback).
func tokenIntrospectHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, client *mongo.Client) {
	var req struct{
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		http.Error(w, "token required", http.StatusBadRequest)
		return
	}

	// Reject obviously malformed tokens (tokens are hex strings)
	isHex, _ := regexp.MatchString("^[0-9a-fA-F]+$", req.Token)
	if !isHex {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "invalid token format"})
		return
	}

	// compute hash prefix
	h := sha256.Sum256([]byte(req.Token))
	hh := hex.EncodeToString(h[:])
	prefix := hh[:8]

	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	filter := bson.M{"hashPrefix": prefix, "active": true}
	cur, err := coll.Find(ctx, filter)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	for cur.Next(ctx) {
		var doc bson.M
		if err := cur.Decode(&doc); err != nil {
			continue
		}
		storedHash, _ := doc["hash"].(string)
		ok := false
		if strings.HasPrefix(storedHash, "$argon2") {
			if match, err := argon2id.ComparePasswordAndHash(req.Token, storedHash); err == nil && match {
				ok = true
			}
		} else if strings.HasPrefix(storedHash, "$2") {
			if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Token)); err == nil {
				ok = true
			}
		} else if strings.HasPrefix(storedHash, "pbkdf2$") {
			parts := strings.Split(storedHash, "$")
			if len(parts) >= 3 {
				salt, _ := hex.DecodeString(parts[1])
				expected := parts[2]
				derived := pbkdf2.Key([]byte(req.Token), salt, 100000, 64, sha256.New)
				if hex.EncodeToString(derived) == expected {
					ok = true
				}
			}
		}
		if ok {
			// check expiry
			expiresAtRaw := doc["expiresAt"]
			if expiresAtRaw != nil {
				if exp, ok2 := expiresAtRaw.(primitive.DateTime); ok2 {
					if time.Now().After(exp.Time()) {
						json.NewEncoder(w).Encode(map[string]interface{}{"active":false})
						return
					}
				}
			}
			info := map[string]interface{}{
				"active": true,
				"userId": fmt.Sprintf("%v", doc["userId"]),
				"scopes": doc["scopes"],
				"expiresAt": doc["expiresAt"],
			}
			json.NewEncoder(w).Encode(info)
			return
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"active": false})
}

// Token creation, listing and revocation handlers
func tokenCreateHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, client *mongo.Client) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	var req struct{
		Label string `json:"label"`
		Scopes []string `json:"scopes"`
		ExpiresAt *time.Time `json:"expiresAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	// generate plaintext token — use crypto/rand for randomness
	var randBytes = make([]byte, 32)
	var plain string
	if _, err := rand.Read(randBytes); err != nil {
		// fallback to time-based digest if crypto/rand unavailable
		plain = fmt.Sprintf("%s-%d", userId, time.Now().UnixNano())
		// compute token as sha256(plain)
		hs := sha256.Sum256([]byte(plain))
		plain = hex.EncodeToString(hs[:])
	} else {
		plain = hex.EncodeToString(randBytes)
	}
	// compute hash and prefix
	h := sha256.Sum256([]byte(plain))
	hh := hex.EncodeToString(h[:])
	prefix := hh[:8]
	// choose algorithm argon2id by default
	hash, _ := argon2id.CreateHash(plain, argon2id.DefaultParams)

	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	doc := bson.M{
		"userId": userId,
		"label": req.Label,
		"hash": hash,
		"hashPrefix": prefix,
		"algorithm": "argon2id",
		"scopes": req.Scopes,
		"active": true,
		"createdAt": time.Now(),
	}
	res, err := coll.InsertOne(ctx, doc)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"id": fmt.Sprintf("%v", res.InsertedID), "token": plain, "accessTokenPartial": prefix})
}

func tokenListHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, client *mongo.Client) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	filter := bson.M{"userId": userId}
	cur, err := coll.Find(ctx, filter)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)
	out := []bson.M{}
	for cur.Next(ctx) {
		var d bson.M
		if err := cur.Decode(&d); err != nil { continue }
		// mask hash
		if d["hash"] != nil { d["hash"] = nil }
		out = append(out, d)
	}
	json.NewEncoder(w).Encode(out)
}

func tokenRevokeHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, client *mongo.Client) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	tokenId := vars["tokenId"]
	coll := client.Database("sharelatex").Collection("personalaccesstokens")
	id, err := primitive.ObjectIDFromHex(tokenId)
	if err != nil {
		http.Error(w, "invalid token id", http.StatusBadRequest)
		return
	}
	res := coll.FindOneAndUpdate(ctx, bson.M{"_id": id, "userId": userId}, bson.M{"$set": bson.M{"active": false}})
	if res.Err() != nil {
		if res.Err() == mongo.ErrNoDocuments {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
	// Reject private-key submissions and malformed public keys
	if strings.Contains(req.PublicKey, "PRIVATE KEY") || strings.HasPrefix(strings.TrimSpace(req.PublicKey), "-----BEGIN") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "invalid public key"})
		return
	}
	// Accept typical public key prefixes: ssh-*, ecdsa-*
	matched, _ := regexp.MatchString(`^(ssh-[a-z0-9-]+|ecdsa-[^\s]+|ssh-ed25519) `, req.PublicKey)
	if !matched {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "invalid public key"})
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

func deleteHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, coll *mongo.Collection) {
	vars := mux.Vars(r)
	userId := vars["userId"]
	keyId := vars["keyId"]
	// attempt to treat keyId as hex ObjectId, but also allow string ids
	filter := bson.M{"_id": keyId, "userId": userId}
	// Try as ObjectID
	if oid, err := primitive.ObjectIDFromHex(keyId); err == nil {
		filter = bson.M{"_id": oid, "userId": userId}
	}
	res := coll.FindOneAndDelete(ctx, filter)
	if res.Err() != nil {
		if res.Err() == mongo.ErrNoDocuments {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		log.Printf("delete error: %v", res.Err())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
