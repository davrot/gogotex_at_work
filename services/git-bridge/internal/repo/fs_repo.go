package repo

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// FSRepoStore manages Git repositories stored on the filesystem.
// This is a minimal implementation to replace the Java FSGitRepoStore used in tests.
type FSRepoStore struct {
	basePath string
}

func NewFSRepoStore(basePath string) *FSRepoStore {
	return &FSRepoStore{basePath: basePath}
}

// RepoPath returns the absolute path for a given project repository name.
func (r *FSRepoStore) RepoPath(project string) string {
	return filepath.Join(r.basePath, project+".git")
}

// InitRepo ensures the repo exists and is a bare git repository.
func (r *FSRepoStore) InitRepo(project string) (string, error) {
	repoPath := r.RepoPath(project)
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return "", fmt.Errorf("mkdir repo path: %w", err)
	}
	// If already a git repo (HEAD exists), nothing to do
	if _, err := os.Stat(filepath.Join(repoPath, "HEAD")); err == nil {
		return repoPath, nil
	}
	// Initialize bare git repository
	cmd := exec.Command("git", "init", "--bare", repoPath)
	cmd.Env = os.Environ()
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("git init failed: %v output: %s", err, string(out))
	}
	return repoPath, nil
}
