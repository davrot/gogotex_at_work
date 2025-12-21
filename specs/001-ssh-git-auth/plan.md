# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

### Naming / Branding

We will use **GoGoTeX** as the canonical label for Go-based services and components created during this migration (e.g., `git-bridge` Go implementation may be referred to as `git-bridge (GoGoTeX)`). Add `-gogotex` or `-gogotex` style annotations to image tags, service names, and internal docs where helpful to indicate an owned Go implementation. This branding helps reviewers and QA quickly differentiate legacy Node/Java components from migrated Go components during the migration period.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Go 1.25 (git-bridge) and Node.js 18+ (web)  
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
- **Observability & Versioning**: Structured logs and instrumentation MUST be used for SSH upsert flows. For local tests, temporary `/tmp/ssh_upsert_debug.log` may be written only when `NODE_ENV=test` and a test-only flag is enabled; production MUST emit structured log events and metrics instead. Required events and metrics are described in the spec (see Observability section); tasks T038, T039, and T040 are added to implement structured logs, metrics, and safe debug gating. Versioning: `git-bridge` will follow semantic versioning.

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
