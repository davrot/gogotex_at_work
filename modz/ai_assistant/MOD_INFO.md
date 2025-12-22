# AI Assistant (mod: `ai_assistant`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1416
- **Author / Contact:** davrot
- **Summary:** Plugin that adds an LLM chat window, global & per-user LLM configuration, and UI integrations for asking AI help on LaTeX errors. Docker images provided in the issue for quick testing.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/ai_assistent
- **License:** GNU Affero GPL v3 (as stated in issue)

## Status in `modz/ai_assistant`

- Files present: **27** files
- Test harness: **smoke test** added (package.json + `test/smoke.test.js`) — executed successfully
- Key files: `services/web/app/src/Features/LLMChat/LLMChatController.mjs` (controller), frontend hooks and components

## Suggested next steps (short-term)

1. Add unit tests for `LLMChatController`:
   - Mock `User.findById` and `fetch` to assert `getModels()` and `chat()` behavior (success, timeout, error, personal-model branch).
2. Add frontend component tests for chat pane and hooks (Vitest + React Testing Library).
3. Add a lightweight CI job to run `npm test` for the module.

## Notes

- The feature is production-ready enough to be demoed via provided Docker images, but lacks integrated tests and CI coverage in this repository.
- Estimated effort to add controller + basic UI tests: **1–2 days**.
