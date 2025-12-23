Migration plan: notifications-go

Goal

- Provide a Go PoC for notifications delivery and queueing semantics used by the service.

PoC tasks

- `/health` endpoint (done)
- Implement in-memory queue and delivery handlers
- Implement endpoints to enqueue messages and list pending items
- Add unit tests and integration script

Checklist

- [ ] implement in-memory queue and handlers
- [ ] add tests and integration script

Owner: @team-notifications
