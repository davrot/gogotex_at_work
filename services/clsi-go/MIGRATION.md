Migration plan: clsi-go

Goal

- Provide a minimal Go replacement for `clsi` that allows the team to iterate safely.

PoC tasks

- `/health` endpoint (done)
- Define domain model and store; start with in-memory store
- Implement main endpoints per existing service contract
- Add unit tests and a small integration script for smoke tests

Optional

- Add Postgres store and DB migrations if persistence is required
- Add Prometheus metrics and logging

Checklist

- [ ] implement in-memory store and tests
- [ ] implement endpoints and tests
- [ ] add integration script and CI snippet

Owner: @team-clsi
