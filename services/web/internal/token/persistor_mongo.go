package token

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ErrNotFound = errors.New("not found")

// MongoPersistor stores token metadata in MongoDB.
type MongoPersistor struct {
	col *mongo.Collection
}

// NewMongoPersistor connects to Mongo and returns a persistor for the given db and collection.
func NewMongoPersistor(ctx context.Context, uri, dbName, collName string) (*MongoPersistor, error) {
	clientOpts := options.Client().ApplyURI(uri)
	cli, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, err
	}
	col := cli.Database(dbName).Collection(collName)
	// ensure index on hash
	idxModel := mongo.IndexModel{Keys: bson.D{{Key: "hash", Value: 1}}, Options: options.Index().SetUnique(true)}
	if _, err := col.Indexes().CreateOne(ctx, idxModel); err != nil {
		return nil, err
	}
	return &MongoPersistor{col: col}, nil
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// Save stores a token (plaintext) by hashing and saving metadata.
func (m *MongoPersistor) Save(ctx context.Context, tokenPlain, userID string, scopes []string) error {
	hash := sha256Hex(tokenPlain)
	doc := bson.M{
		"hash":      hash,
		"hashPrefix": hash[:8],
		"algorithm": "sha256",
		"userId":    userID,
		"active":    true,
		"scopes":    scopes,
		"createdAt": time.Now().UTC(),
	}
	_, err := m.col.InsertOne(ctx, doc)
	if mongo.IsDuplicateKeyError(err) {
		// Upsert semantics: update existing
		_, err = m.col.UpdateOne(ctx, bson.M{"hash": hash}, bson.M{"$set": doc})
	}
	return err
}

// Introspect returns metadata for a token plaintext if present.
func (m *MongoPersistor) Introspect(ctx context.Context, tokenPlain string) (TokenMeta, error) {
	hash := sha256Hex(tokenPlain)
	var doc struct {
		HashPrefix string   `bson:"hashPrefix"`
		Algorithm  string   `bson:"algorithm"`
		UserID     string   `bson:"userId"`
		Active     bool     `bson:"active"`
		Scopes     []string `bson:"scopes"`
	}
	err := m.col.FindOne(ctx, bson.M{"hash": hash}).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return TokenMeta{}, ErrNotFound
		}
		return TokenMeta{}, err
	}
	return TokenMeta{HashPrefix: doc.HashPrefix, Algorithm: doc.Algorithm, UserID: doc.UserID, Active: doc.Active, Scopes: doc.Scopes}, nil
}

// Revoke marks a token inactive.
func (m *MongoPersistor) Revoke(ctx context.Context, tokenPlain string) error {
	hash := sha256Hex(tokenPlain)
	res, err := m.col.UpdateOne(ctx, bson.M{"hash": hash}, bson.M{"$set": bson.M{"active": false}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}
