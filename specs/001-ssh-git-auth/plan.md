# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Go 1.21 (git-bridge) and Node.js 18+ (web)  
**Primary Dependencies**: net/ssh (golang.org/x/crypto/ssh), system `git` binary (invoked via os/exec), Mongoose 8.x (web), MongoDB 6.x  
**Storage**: MongoDB (`sharelatex.usersshkeys` collection)  
**Testing**: Go unit/integration tests (`go test`), Mocha contract tests for web (`npm test` / `test:contract`), Playwright for E2E where applicable  
**Target Platform**: Linux containers (Docker Compose local dev, Kubernetes/staging/production)  
**Project Type**: multi-service backend: `services/git-bridge` (Go) and `services/web` (Node.js)  
**Performance Goals**: p95 < 2s for small repos (clone/push); p99 < 10s (see spec)  
**Constraints**: Must retrieve SSH keys via internal authenticated web-profile API (no direct DB reads by `git-bridge` unless authorized). Use system `git` for repo ops initially to ensure parity.  
**Scale/Scope**: Serve Overleaf production traffic (tens to hundreds of requests/sec); initial perf harness targets representative local runs and CI scheduled perf jobs

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Code Quality**: Linting and formatting enforced by existing project ESLint/Prettier and Go linters; PRs will include small, focused changes and tests. (Plan: add linters to `services/git-bridge` CI job.)
- **Testing Standards**: Unit tests required for parsing/validation and auth logic; integration/contract tests (Mocha) required for idempotency and auth flows; performance harness will be added for `git-bridge` (perf tests optional in CI).
- **User Experience Consistency**: Web UI changes limited to SSH key management components and follow existing styles. Acceptance tests will validate UI flows.
- **Performance Requirements**: Performance SLOs (p95 < 2s) defined in spec and will be validated by the perf harness.
- **Observability & Versioning**: Structured logs and `/tmp/ssh_upsert_debug.log` instrumentation added for test runs; production will use structured logging; versioning: `git-bridge` will follow semantic versioning.

No constitution violations are identified at Phase 0; follow-ups (e.g., CI runner sizing for perf jobs) are documented in research.md as NEEDS CLARIFICATION.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
