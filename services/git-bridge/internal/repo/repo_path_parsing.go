package repo

import (
	"net/url"
	"path"
	"strings"
)

// SlugFromPath converts a repo path like `/repo/acme/hello-world.git` into `acme/hello-world`.
func SlugFromPath(p string) string {
	p = strings.TrimSpace(p)
	// Remove all leading slashes
	for strings.HasPrefix(p, "/") {
		p = strings.TrimPrefix(p, "/")
	}
	// Remove optional leading "repo/"
	if strings.HasPrefix(p, "repo/") {
		p = strings.TrimPrefix(p, "repo/")
	}
	p = strings.TrimSuffix(p, ".git")
	// URL-decode each segment
	parts := strings.Split(p, "/")
	for i, seg := range parts {
		if decoded, err := url.PathUnescape(seg); err == nil {
			parts[i] = decoded
		}
	}
	// clean path to collapse redundant separators and remove any '.' or '..' segments
	cleaned := path.Clean(strings.Join(parts, "/"))
	// path.Clean may return '.' for empty or '.' results; normalize to empty string
	if cleaned == "." {
		return ""
	}
	// ensure no leading slash
	return strings.TrimPrefix(cleaned, "/")
}
