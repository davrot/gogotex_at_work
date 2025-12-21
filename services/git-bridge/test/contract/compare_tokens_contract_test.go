package contract

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"

	"golang.org/x/crypto/pbkdf2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func seedToken(t *testing.T, ctx context.Context, mongoURI, userID string) (string, string) {
	clientOpts := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		t.Fatalf("mongo connect failed: %v", err)
	}
	defer client.Disconnect(ctx)
	coll := client.Database("sharelatex").Collection("personalaccesstokens")

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		t.Fatalf("rand.Read failed: %v", err)
	}
	token := hex.EncodeToString(tokenBytes)
	shaSum := sha256.Sum256([]byte(token))
	prefix := hex.EncodeToString(shaSum[:])[:8]

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		t.Fatalf("rand.Read(salt) failed: %v", err)
	}
	derived := pbkdf2.Key([]byte(token), salt, 100000, 64, sha256.New)
	hash := fmt.Sprintf("pbkdf2$%s$%s", hex.EncodeToString(salt), hex.EncodeToString(derived))

	doc := bson.M{
		"userId": userID,
		"label": "compare-token",
		"hash": hash,
		"hashPrefix": prefix,
		"algorithm": "pbkdf2",
		"scopes": []string{},
		"active": true,
		"createdAt": time.Now(),
	}
	res, err := coll.InsertOne(ctx, doc)
	if err != nil {
		t.Fatalf("insert token failed: %v", err)
	}
	oid := res.InsertedID.(primitive.ObjectID).Hex()
	return oid, token
}

func TestCompareTokensParity(t *testing.T) {
	script := "../../../../scripts/contract/compare_tokens_parity.sh"
	cmd := exec.Command(script)
	cmd.Env = append(cmd.Env, "NODE_BASE=http://develop-web-1:3000", "GO_BASE=http://localhost:3900")
	_, err := cmd.CombinedOutput()
	if err == nil {
		return
	}

	// If script failed, try seeding tokens directly in Mongo and re-run the script with seeded ids
	ctx := context.Background()
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://mongo:27017/sharelatex"
	}

	nodeUserId := primitive.NewObjectID().Hex()
	goUserId := primitive.NewObjectID().Hex()
	nNodeID, nToken := seedToken(t, ctx, mongoURI, nodeUserId)
	gGoID, gToken := seedToken(t, ctx, mongoURI, goUserId)

	cmd2 := exec.Command(script)
	cmd2.Env = append(cmd2.Env,
		"NODE_BASE=http://develop-web-1:3000",
		"GO_BASE=http://localhost:3900",
		"NODE_SEED_ID="+nNodeID,
		"NODE_SEED_TOKEN="+nToken,
		"GO_SEED_ID="+gGoID,
		"GO_SEED_TOKEN="+gToken,
		"USER_ID="+nodeUserId,
		"GO_USER_OVERRIDE="+goUserId,
		"MONGO_URI="+mongoURI,
	)
	out2, err2 := cmd2.CombinedOutput()
	if err2 != nil {
		t.Fatalf("compare_tokens_parity failed after seeding: %v\noutput: %s", err2, string(out2))
	}
}
