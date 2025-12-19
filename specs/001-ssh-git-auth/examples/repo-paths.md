# Repo-path → projectId canonical examples

This file documents canonical examples and edge cases the `git-bridge` repo-path parser must handle. Add unit tests to `services/git-bridge` that verify these transformations.

Examples:
- `/repo/acme/hello-world.git` → slug `acme/hello-world`
- `/repo/acme/hello-world` → slug `acme/hello-world` (missing `.git` suffix tolerated)
- `/repo/acme/space%20name.git` → slug `acme/space name` (URL-decoded segments)
- `/repo/acme/nested/inner.git` → slug `acme/nested/inner` (multiple segments allowed)
- `/repo/acme/` → malformed (missing repo name); parser should return an error or 400
- `/repo/owner/.git` → malformed; parser should return 400 for clearly invalid paths

Add tests for url-encoded paths, leading/trailing slashes, and non-ASCII characters where applicable.
