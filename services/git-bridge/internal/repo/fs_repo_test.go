package repo

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInitRepoCreatesBareRepo(t *testing.T) {
	tmp := t.TempDir()
	store := NewFSRepoStore(tmp)
	repoPath, err := store.InitRepo("testproject")
	if err != nil {
		t.Fatalf("InitRepo failed: %v", err)
	}
	// verify repo path is correct and HEAD exists
	expected := filepath.Join(tmp, "testproject.git")
	if repoPath != expected {
		t.Fatalf("unexpected repoPath: got %s want %s", repoPath, expected)
	}
	if _, err := os.Stat(filepath.Join(repoPath, "HEAD")); err != nil {
		t.Fatalf("expected HEAD in repo, stat failed: %v", err)
	}
}
