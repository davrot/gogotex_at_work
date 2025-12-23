Migration plan: document-updater-go

Goal

- Make a small Go PoC for the document-updater service for safe iteration.

PoC tasks

- `/health` endpoint (done)
- Identify update API surface, implement basic handler(s)
- Start with in-memory store or in-process message handling
- Unit tests and a small integration script

Optional

- Add Postgres-backed operations or message queues if needed

Checklist

- [ ] implement basic handlers
- [ ] add unit tests
- [ ] add integration script & CI snippet

Owner: @team-document-updater
