package store

import "sync"

// Store is a tiny in-memory key/value store used for basic unit tests and
// lightweight parity checks in CI.
type Store struct {
	mu   sync.Mutex
	data map[string]string
}

// New returns a new Store instance.
func New() *Store {
	return &Store{data: make(map[string]string)}
}

// Put stores a value for a given key.
func (s *Store) Put(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = value
}

// Get retrieves a value by key.
func (s *Store) Get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.data[key]
	return v, ok
}

// Delete removes a key from the store.
func (s *Store) Delete(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, key)
}

// List returns a shallow copy of all key/value pairs.
func (s *Store) List() map[string]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]string, len(s.data))
	for k, v := range s.data {
		out[k] = v
	}
	return out
}
