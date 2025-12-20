package repo

import (
	"net/url"
	"path"
	"strings"
)

// SlugFromPath converts a repo path like `/repo/acme/hello-world.git` into `acme/hello-world`.
func SlugFromPath(p string) string {
	p = strings.TrimSpace(p)
	p = strings.TrimPrefix(p, "/")
	p = strings.TrimPrefix(p, "repo/")
	p = strings.TrimSuffix(p, ".git")
	// URL-decode each segment
	parts := strings.Split(p, "/")
	for i, seg := range parts {
		if decoded, err := url.PathUnescape(seg); err == nil {
			parts[i] = decoded
		}
	}
	// clean path to collapse redundant separators
	cleaned := path.Clean(strings.Join(parts, "/"))
	return cleaned
}
