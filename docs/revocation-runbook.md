# Deterministic revocation troubleshooting

If a `DELETE /internal/api/users/:userId/git-tokens/:tokenId` appears to succeed but subsequent `introspect` returns `active: true`:

1. Confirm that the `DELETE` returned 2xx; if it returned 404/401 review access logs and request headers.
2. Use `GET /internal/api/debug/inspect-session` (dev-only) to confirm session middleware sees the cookie and `req.session` is present.
3. If the DELETE returned HTML `Page Not Found` while a session cookie was present, check router mount order and the `AuthenticationController` / CSRF middleware configuration; ensure private/internal routes are mounted before public HTML catch-all routes.
4. Use `POST /internal/api/cache/invalidate` (requires private API auth) to force invalidation as an emergency mitigation.
5. Check pubsub health and subscriber logs: ensure `auth.cache.invalidate` messages are published and subscribers log receipt within expected window.
6. If the issue is reproducible, add a failing integration test using `services/web/test/integration/src/DeleteSessionMiddlewareDiagnosticTests.mjs` and file an issue referencing T019d.

## Emergency steps

- To temporarily mitigate stale revocation visibility, call `POST /internal/api/cache/invalidate` with `{ channel: 'auth.cache.invalidate', key: 'token:hashprefix:xxxx' }`.
- Always capture request/response traces and server logs when reproducing the issue.
