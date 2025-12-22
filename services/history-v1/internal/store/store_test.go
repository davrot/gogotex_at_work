package store

import "testing"

func TestStorePutGetDeleteList(t *testing.T) {
	s := New()
	if _, ok := s.Get("k"); ok {
		t.Fatalf("expected empty store")
	}

	s.Put("k", "v")
	v, ok := s.Get("k")
	if !ok || v != "v" {
		t.Fatalf("expected value 'v', got '%s' ok=%v", v, ok)
	}

	s.Put("k2", "v2")
	all := s.List()
	if len(all) != 2 {
		t.Fatalf("expected 2 items, got %d", len(all))
	}

	s.Delete("k")
	if _, ok := s.Get("k"); ok {
		t.Fatalf("expected key deleted")
	}
}
