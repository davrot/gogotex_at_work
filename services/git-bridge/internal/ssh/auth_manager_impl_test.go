package ssh

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestLookupCachesPositive(t *testing.T) {
	var calls int32
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"userId":"u-1"}`))
	}))
	defer h.Close()

	os.Setenv("SSH_LOOKUP_BASE_URL", h.URL)
	os.Setenv("CACHE_LOOKUP_TTL_SECONDS", "60")
	os.Setenv("CACHE_NEGATIVE_TTL_SECONDS", "5")
	am, err := NewAuthManagerFromEnv(h.Client())
	if err != nil {
		t.Fatalf("NewAuthManagerFromEnv error: %v", err)
	}
	ctx := context.Background()
	defer am.Close(ctx)

	user, err := am.LookupUserForFingerprint(ctx, "SHA256:AAA")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if user != "u-1" {
		t.Fatalf("unexpected user: %s", user)
	}
	user2, err := am.LookupUserForFingerprint(ctx, "SHA256:AAA")
	if err != nil {
		t.Fatalf("unexpected err on second lookup: %v", err)
	}
	if user2 != "u-1" {
		t.Fatalf("unexpected user on second lookup: %s", user2)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatalf("expected single backend call, got %d", calls)
	}
}

func TestNegativeCache(t *testing.T) {
	var calls int32
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusNotFound)
	}))
	defer h.Close()

	os.Setenv("SSH_LOOKUP_BASE_URL", h.URL)
	os.Setenv("CACHE_LOOKUP_TTL_SECONDS", "60")
	os.Setenv("CACHE_NEGATIVE_TTL_SECONDS", "60")
	am, err := NewAuthManagerFromEnv(h.Client())
	if err != nil {
		t.Fatalf("NewAuthManagerFromEnv error: %v", err)
	}
	ctx := context.Background()
	defer am.Close(ctx)

	user, err := am.LookupUserForFingerprint(ctx, "SHA256:BBB")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if user != "" {
		t.Fatalf("expected empty user for 404, got %s", user)
	}
	user2, err := am.LookupUserForFingerprint(ctx, "SHA256:BBB")
	if err != nil {
		t.Fatalf("unexpected err on second lookup: %v", err)
	}
	if user2 != "" {
		t.Fatalf("expected empty user on second lookup, got %s", user2)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatalf("expected single backend call for negative cache, got %d", calls)
	}
}

func TestTTLExpiry(t *testing.T) {
	var calls int32
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"userId":"u-2"}`))
	}))
	defer h.Close()

	os.Setenv("SSH_LOOKUP_BASE_URL", h.URL)
	os.Setenv("CACHE_LOOKUP_TTL_SECONDS", "1")
	os.Setenv("CACHE_NEGATIVE_TTL_SECONDS", "1")
	am, err := NewAuthManagerFromEnv(h.Client())
	if err != nil {
		t.Fatalf("NewAuthManagerFromEnv error: %v", err)
	}
	ctx := context.Background()
	defer am.Close(ctx)

	_, err = am.LookupUserForFingerprint(ctx, "SHA256:CCC")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatalf("expected one backend call, got %d", calls)
	}
	// Wait for TTL to expire
	time.Sleep(1100 * time.Millisecond)
	_, err = am.LookupUserForFingerprint(ctx, "SHA256:CCC")
	if err != nil {
		t.Fatalf("unexpected err after expiry: %v", err)
	}
	if atomic.LoadInt32(&calls) != 2 {
		t.Fatalf("expected backend to be called again after TTL expiry, got %d", calls)
	}
}
