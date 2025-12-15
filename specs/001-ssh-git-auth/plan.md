# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: Node.js (>=18), modern ESM and some legacy CommonJS interop  
**Primary Dependencies**: Express (web server), Mongoose (MongoDB ODM), Playwright (E2E), Vitest/Mocha (unit/contract tests), Docker Compose (dev infra), ioredis, webpack for dev frontend builds  
**Storage**: MongoDB (replica set in dev using `mongo` service, DB name `sharelatex`)  
**Testing**: Vitest for focused unit tests (ESM), Mocha for legacy suites, Playwright for E2E; contract tests for API interactions; CI runs tests in Docker-based env  
**Target Platform**: Linux servers (containers); dev and CI run in Docker Compose dev stacks  
**Project Type**: Web application (backend + frontend assets), with a separate `git-bridge` service (Java) that integrates via internal API  
**Performance Goals**: NEEDS CLARIFICATION — define target p95 latency for `git clone`/`git push` (suggest baseline: p95 < 2s for small test repo)  
**Constraints**: Must integrate with existing dev Docker Compose network (services addressable via internal hostnames like `develop-*` or docker network IPs); tests should avoid globally mutating infra (use focused harnesses)  
**Scale/Scope**: Initial rollout targeted at single cluster; feature impacts authentication for all Git operations and UI account management

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Code Quality (required)**: All new backend and frontend code will be linted and formatted; PRs must include focused diffs and description.
- **Testing Standards (required)**: Unit tests for new logic (key parsing, fingerprinting), contract tests for internal API between web-profile and git-bridge, and Playwright E2E for UI flows. Focused test harnesses (`test/focused`) are used to avoid global infra changes.
- **Observability (required)**: Add structured logs for SSH key add/delete events (`sshkey.added`, `sshkey.removed`) and ensure events include user_id and fingerprint (no private key material).
- **Performance (informative)**: Define p95/p99 SLOs for Git operations in Phase 1.

Status: No unresolved constitution violations detected at Phase 0 entry; will re-evaluate after design artifacts are produced.

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
