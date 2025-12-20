# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: Go 1.25 (primary for `git-bridge`), Node.js 20.x (web/profile), MongoDB 6.x, Redis 7.x, Docker Compose for local integration.
**Primary Dependencies**: Go stdlib + `go-git` or invoking system `git` (decision: **NEEDS CLARIFICATION**), `ssh`/authentication libraries, `chi`/`gorilla`-style HTTP router for internal API calls; on the web side: Express + Mongoose (existing).
**Storage**: User SSH keys persisted in MongoDB (web-profile service); `git-bridge` will retrieve keys via the internal authenticated web-profile API (direct DB access from `git-bridge` is disallowed unless explicitly authorized).
**Testing**: Unit tests: `go test` for `git-bridge` logic; Integration tests: Docker Compose environment with real services (web, mongo, redis, git-bridge) and contract tests (Mocha) for cross-service behaviors; Performance tests: representative `git clone`/`git push` benchmark harness (runnable in CI / locally).
**Target Platform**: Linux server containers (Docker); CI runners that can run Docker compose stacks.
**Project Type**: Backend service (networked, containerized), integrating with the web-profile service and the repo storage backend.
**Performance Goals**: For small test repos (<=1MB, <=10 files) target **p95 < 2s**, **p99 < 10s** for `git clone` and `git push` under normal load (matching spec SC-003).
**Constraints**: Must use the internal web-profile API for key retrieval and honor existing security model (service tokens / mTLS — **NEEDS CLARIFICATION** on the chosen auth mechanism). Must not introduce any persistent plaintext private key storage. Must be compatible with existing docker-based dev environment and CI.
**Scale/Scope**: Initial rollout scoped to staging environments and small test repos; production must be able to handle expected Overleaf traffic (estimated scale: thousands of daily users; exact SRE targets **NEEDS CLARIFICATION**).

### Open questions / NEEDS CLARIFICATION

- Auth between `git-bridge` and web-profile internal API: prefer service token or mTLS? (security team requirement) — **NEEDS CLARIFICATION**
- Strategy for Git authentication implementation: run an SSH server that consults web-profile per connection, or validate SSH keys during Git push handshake and map to users without a full SSHd? (design tradeoffs: performance vs simplicity) — **NEEDS CLARIFICATION**
- Use of `go-git` vs shelling out to system `git` for repository operations and hook handling — **NEEDS CLARIFICATION**
- CI performance-test runner availability and limits (how to run p95/p99 measurements reliably in CI) — **NEEDS CLARIFICATION**
- Migration coordination window for removing Java legacy code (timing + integration owners) — **NEEDS CLARIFICATION**

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Code Quality (NON-NEGOTIABLE)**: OK — implementation will follow project linters, formatting, and PR review rules. Unit tests will accompany all new logic.
- **Testing Standards (NON-NEGOTIABLE)**: PARTIAL — unit and integration tests are planned; performance tests are required for acceptance and will be added in Phase 1. CI integration for performance tests is **NEEDS CLARIFICATION**.
- **User Experience Consistency**: N/A for core auth but UI changes (SSH key management) will follow component library and accessibility requirements.
- **Performance Requirements**: MUST be met; performance test harness and targets are included in Phase 1. No violations yet but the approach depends on CI runner availability (**NEEDS CLARIFICATION**).
- **Observability & Versioning**: OK — security/auth events and metrics will be instrumented; logging format and audit fields will be specified in Phase 1.

**Decision**: Proceed to Phase 0 research with the open clarifications listed in Technical Context (auth mechanism, git implementation choice, CI performance runner). These clarifications must be resolved in Phase 0 research (research.md) before moving to Phase 1 design.

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
