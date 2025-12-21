package ssh

// AuthManager implements fingerprint -> user lookups with short-lived caching.
// It encapsulates the HTTP lookup client, cache TTLs, and a simple in-memory cache
// that can be extended to use Redis pubsub invalidation later.

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"errors"
	"github.com/overleaf/git-bridge/internal/lookup"
	"github.com/overleaf/git-bridge/internal/webprofile"
)

type cacheEntry struct {
	userId    string
	expiresAt time.Time
}

type AuthManager struct {
	client   *http.Client
	baseURL  string
	ttl      time.Duration
	negTtl   time.Duration
	mu       sync.RWMutex
	cache    map[string]cacheEntry
	closed   bool
}

// NewAuthManagerFromEnv constructs an AuthManager using environment variables:
// - SSH_LOOKUP_BASE_URL (required)
// - CACHE_LOOKUP_TTL_SECONDS (default 60)
// - CACHE_NEGATIVE_TTL_SECONDS (default 5)
func NewAuthManagerFromEnv(client *http.Client) (*AuthManager, error) {
	base := os.Getenv("SSH_LOOKUP_BASE_URL")
	if base == "" {
		return nil, errors.New("SSH_LOOKUP_BASE_URL is required")
	}
	ttl := 60
	if v := os.Getenv("CACHE_LOOKUP_TTL_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			ttl = n
		}
	}
	neg := 5
	if v := os.Getenv("CACHE_NEGATIVE_TTL_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			neg = n
		}
	}
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &AuthManager{
		client:  client,
		baseURL: base,
		ttl:     time.Duration(ttl) * time.Second,
		negTtl:  time.Duration(neg) * time.Second,
		cache:   make(map[string]cacheEntry),
	}, nil
}

// LookupUserForFingerprint returns the userId for the given fingerprint or empty string if not found.
// It consults a short-lived in-memory cache first.
func (a *AuthManager) LookupUserForFingerprint(ctx context.Context, fingerprint string) (string, error) {
	if a == nil {
		return "", errors.New("auth manager nil")
	}
	// Check cache
	a.mu.RLock()
	if e, ok := a.cache[fingerprint]; ok {
		if time.Now().Before(e.expiresAt) {
			user := e.userId
			a.mu.RUnlock()
			return user, nil
		}
	}
	a.mu.RUnlock()

	// Miss: call lookup
	user, err := lookup.LookupFingerprint(a.client, a.baseURL, fingerprint)
	if err != nil {
		return "", err
	}
	// Store positive or negative TTL
	a.mu.Lock()
	if user == "" {
		a.cache[fingerprint] = cacheEntry{userId: "", expiresAt: time.Now().Add(a.negTtl)}
	} else {
		a.cache[fingerprint] = cacheEntry{userId: user, expiresAt: time.Now().Add(a.ttl)}
	}
	a.mu.Unlock()
	return user, nil
}

func (a *AuthManager) Close(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return nil
	}
	a.closed = true
	// future: close redis clients, pubsub subscriptions
	return nil
}

// IntrospectToken forwards token introspection to the web-profile service and
// returns the mapped userId and whether the token was active.
func (a *AuthManager) IntrospectToken(token string) (string, bool, error) {
	if token == "" {
		return "", false, nil
	}
	base := a.baseURL // web-profile base is same as lookup base by default
	userId, active, err := webprofile.IntrospectToken(a.client, base, token)
	return userId, active, err
}
