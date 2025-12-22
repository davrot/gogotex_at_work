Title: Import reduced snapshots of multiple modules into `modz/` (integrate/modz)

Summary:
This PR imports a set of modules (reduced to branch-local changed files) into a top-level `modz/` area for consolidation and iterative test hardening. It also adds initial unit tests, smoke tests, stubs, and a CI workflow to run per-module tests. The goal is to validate testability and prepare follow-up work to migrate canonical files into their final locations and delete `modz/` for cleanup.

Modules imported (partial list):

- ai_assistant
- track-changes-and-comments
- latex-editor
- sandbox-compile
- references
- admin_extensions
- logo-tools

What I changed:

- Added `modz/<module>/` directories with reduced snapshots and `MOD_INFO.md` for provenance.
- Added unit tests and smoke tests for priority modules:
  - `modz/ai_assistant`: LLMChatController unit tests, config.example, config loader, LLM gating test, small SessionManager shim for test isolation.
  - `modz/track-changes-and-comments`: `DocumentManager` unit test and lightweight stubs for Redis/Persistence/etc.
  - `modz/latex-editor`, `modz/sandbox-compile`: smoke test skeletons.
- Added root `package.json` test scripts to run per-module tests (e.g., `npm run test:modz:ai_assistant`).
- Added `.github/workflows/modz-tests.yml` to run mod tests on pushes to `integrate/modz` and PRs targeting it.
- Updated `specs/` tasks to mark completed subtasks and added `specs/modz_followups.md` with open items for follow-up issues.

Test plan & status:

- Local unit tests:
  - `modz/ai_assistant` unit tests: 3 tests passed locally.
  - `modz/track-changes-and-comments` unit test: 1 test passed locally.
- Smoke tests:
  - `modz/latex-editor` and `modz/sandbox-compile` smoke scripts ran locally.
- CI: `modz-tests.yml` added; will run on PR if created.

Blocked items & follow-ups:

- PR creation via this agent failed due to missing GitHub CLI and invalid/missing GitHub token; manual PR creation is needed or provide credentials to automate.
- Remaining follow-ups (see `specs/modz_followups.md`): references worker tests, admin_extensions controller tests, logo_tools smoke tests, latex-editor accessibility tests, and additional integration tests.

Recommendation:

- Create the PR targeting `main` from `integrate/modz` and run CI; fix any test failures reported in CI.
- For modules requiring more work, create dedicated issues and assign owners (I've added `specs/modz_followups.md` with suggested owners/estimates).
- After canonicalization & migration of files into final locations, delete `modz/` in a follow-up PR.

Notes for maintainers:

- Live LLM tests are gated behind a local config file `modz/ai_assistant/test/config.local.json` and `RUN_LLM_TESTS` environment variable to prevent secrets leakage in CI.
- Many tests use test stubs to avoid depending on Redis/Mongo in CI.

Manual PR creation steps:

1. Visit: https://github.com/your-repo/pulls/new?head=<your-fork>:integrate/modz&base=main
2. Paste this PR body and title.
3. Request review and merge when CI is green.

If you want, I can create the PR and open GitHub issues automatically if you provide a GitHub token or run the gh CLI locally (I don't have credentials).
