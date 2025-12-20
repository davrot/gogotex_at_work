package ssh

import (
	"context"
	"testing"
)

func TestNewAuthManager(t *testing.T) {
	am := NewAuthManager()
	if am == nil {
		t.Fatalf("NewAuthManager returned nil")
	}
	if err := am.Close(context.Background()); err != nil {
		t.Fatalf("Close returned error: %v", err)
	}
}
