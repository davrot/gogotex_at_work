# Track Changes & Comments (mod: `track-changes-and-comments`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1427
- **Author / Contact:** davrot
- **Summary:** Reconstructs a lost/partially-deleted 'track changes & comments' feature; includes backend DocumentManager & frontend review panel code to restore comment threads and track changes flows.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/track-changes-and-comments
- **License:** GNU Affero GPL v3

## Status in `modz/track-changes-and-comments`

- Files present: **20** files
- Test harness: **smoke test added** (package.json + `test/smoke.test.js`) and passed locally
- Key files: `services/document-updater/app/js/DocumentManager.js`, `services/web/modules/track-changes/**`

## Suggested next steps

1. Add unit tests for `DocumentManager` core functions (mock Redis, PersistenceManager, RangesManager). (P1)
2. Add a couple of integration tests (in-memory Redis or mocked interfaces) to validate critical flows (setDoc → flush → persistence). (P1)
3. Add CI job which runs the tests and documents required env for local runs in `MOD_INFO.md` or `modz/.ci/test-harness.md`.

## Notes

- This module is backend-heavy and requires careful mocking; estimated effort: **3–5 days** to reach strong unit & integration coverage.
