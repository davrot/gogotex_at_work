Migration plan: filestore-go

Goal

- Provide a Go-based filestore PoC supporting basic write/read operations for files metadata and optional file uploads.

PoC tasks

- `/health` endpoint (done)
- Implement in-memory metadata store and handlers
- Provide endpoints for create/list and (optionally) upload/download (can be stubbed for PoC)
- Add unit tests and integration script

Persistence

- Consider Postgres or object storage (GCS/S3) integration as follow-up

Checklist

- [ ] implement metadata store and handlers
- [ ] add integration script and CI snippet

Owner: @team-filestore
