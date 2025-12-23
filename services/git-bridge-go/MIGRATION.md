Migration plan: git-bridge-go

Goal
- Implement a PoC of the Git bridge auth layer in Go (matching existing functionality) and provide a stable starting point for further work.

PoC tasks
- `/health` endpoint (done)
- Implement the auth flow handlers and minimal acceptance tests
- Start with in-memory verification and mock external dependencies
- Add unit tests and an integration script

Checklist
- [ ] implement handlers and tests
- [ ] add integration script and CI snippet

Owner: @team-git-bridge
