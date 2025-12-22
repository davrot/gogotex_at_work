# Admin Panel Enhancements (mod: `admin_extensions`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1417
- **Author / Contact:** davrot
- **Summary:** A set of admin panel improvements (project lookup, user management, site/status pages). Branch with changes is provided in the issue for reviewers.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/admin_extensions
- **License:** GNU Affero GPL v3 (as stated in issue)

## Status in `modz/admin_extensions`

- Files present: **16** functional files (controllers, views, module index)
- Test harness: **no package.json/tests present** (module currently lacks test coverage in `modz`)
- Key files: `services/web/app/src/Features/ServerAdmin/AdminController.mjs`, `services/web/modules/admin-project-list/**`

## Suggested next steps

1. Add controller unit tests for `AdminController` and `ProjectListController` (mock persistence layer). (P1)
2. Add a `package.json` and smoke test, then add CI test job. (P1)
3. Draft a short integration guide in `MOD_INFO.md` describing how to mount/overlay the files into an existing dev image for manual testing.

## Notes

- The issue contains a Docker image for quick verification; community discussion exists but no assignees yet.
- Estimated effort to add basic tests & CI: **1–2 days**.
