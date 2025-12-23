Migration plan: history-v1-go

Goal

- Provide a Go implementation for the history service’s API for list/retrieve operations.

PoC tasks

- `/health` endpoint (done)
- Define models and an in-memory store with concurrency tests
- Implement HTTP handlers with unit tests
- Add integration script and CI snippet

Checklist

- [ ] implement in-memory store and tests
- [ ] implement handlers and tests
- [ ] add integration script and CI snippet

Owner: @team-history
