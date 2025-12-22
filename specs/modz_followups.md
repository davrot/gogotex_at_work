Modz integration follow-ups

Branch: `integrate/modz` (pushed to origin)
PR creation: failed due to missing GitHub CLI / API credentials. Please create a PR targeting `main` from `integrate/modz` (or provide credentials to automate).

Open follow-up items (created after import & initial tests):

- references (T052e)
  - Owner: TBD
  - Effort: 2-3 days
  - Tasks:
    - add unit tests for worker/indexer
    - add integration tests for frontend references UI
    - ensure lint & build scripts present
  - Blocking: access to sample indexed data; test harness for worker

- admin_extensions (T052f)
  - Owner: TBD
  - Effort: 2-4 days
  - Tasks:
    - add controller unit tests (ProjectList, UserActivate)
    - add component tests for frontend (ProjectList pagination)
    - reconcile auth/session shims used in ai_assistant tests with app-wide patterns
  - Blocking: review of auth session contract and available test doubles

- logo_tools (T052g) — **Integrated into main; no follow-up required.**
  - Owner: (integrated)
  - Effort: 0 days
  - Notes:
    - The logo_tools module has already been integrated into the main project and no CI smoke tests are required per stakeholder direction.
    - The scripts remain available in the repo for manual use and future adoption if desired.
  - Blocking: none

- latex-editor accessibility tests (T052a follow-up)
  - Owner: TBD
  - Effort: 2-3 days
  - Tasks:
    - add component unit & accessibility tests (Playwright/Testing Library)
    - add visual regression harness if desired
  - Blocking: none

- sandbox-compile Docker checks
  - Owner: TBD
  - Effort: 1-2 days
  - Tasks:
    - add CI matrix job with a Docker runner or service to verify compile image and sample compile jobs
  - Blocking: CI runner with docker privileges or dedicated job

Notes & Recommendations:

- Once PRs are opened and merged, delete `modz/` and migrate canonical files to top-level modules as intended.
- For creating GitHub Issues automatically, provide a valid GITHUB_TOKEN with repo permissions or create them manually referencing this document.

How to run current mod tests locally:

- ai_assistant unit tests: npm run test:modz:ai_assistant
- track-changes unit tests: npm run test:modz:track_changes
- smoke tests: npm run test:modz:latex-editor && npm run test:modz:sandbox-compile

If you want, I can:

- Open the PR and create the issues automatically if you provide a GitHub token or the gh CLI.
- Draft PR body and issue templates here for convenience (no action taken until you approve).
