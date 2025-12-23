Migration plan: sandbox-compile-go

Goal
- Create a Go PoC that wraps the compilation flows in a safe testable way.

PoC tasks
- `/health` endpoint (done)
- Implement minimal compile trigger endpoint and stub execution path
- Use in-memory job queue for PoC
- Add unit tests and integration script

Checklist
- [ ] implement compile-trigger endpoint and tests
- [ ] add integration script and CI snippet

Owner: @team-compile
