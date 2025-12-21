# quickstart.md

## Run Playwright E2E locally (dev Docker Compose)

1. Start dev stack:
   - docker compose -f develop/docker-compose.yml up --build
2. In `services/web`, run the Playwright e2e script using the internal webpack host (use `develop` network host or IP):
   - cd services/web
   - RESET_DB=true ADD_SSH_KEYS=true CHECK_SSH_KEYS=true EXPECTED_SSH_KEYS=2 BASE_URL=http://172.18.0.X:3808 CONFIRM_BASE_URL=true CONFIRM_DEV_SETUP=true npm run e2e:playwright
3. Inspect artifacts in `services/web/test/e2e/playwright/out/` (screenshots, saved responses)
4. Verify DB persistence:
   - docker compose -f develop/docker-compose.yml exec -T mongo mongosh --quiet --eval "db = db.getSiblingDB('sharelatex'); printjson(db.usersshkeys.find({ userId: ObjectId('<userId_from_logs>') }).toArray())"

Notes:

- The pre-run hook enforces correct `BASE_URL` and a manual confirmation unless bypassed by `CONFIRM_BASE_URL=true` and `CONFIRM_DEV_SETUP=true`.
- If E2E shows keys in UI but DB queries return empty, capture and examine the saved HTTP responses in `out/` (Playwright will be enhanced to save POST responses and status codes).
