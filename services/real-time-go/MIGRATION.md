Migration plan: real-time-go

Goal

- Provide a Go PoC for the real-time service that can run locally and be used for acceptance testing.

PoC tasks

- `/health` endpoint (done)
- Implement basic API surface for the service (e.g., publish/subscribe stubs)
- Start with an in-memory channel/queue and unit tests
- Add integration script and optional load test later

Checklist

- [ ] implement basic API surface and tests
- [ ] add integration script and CI snippet

Owner: @team-realtime
