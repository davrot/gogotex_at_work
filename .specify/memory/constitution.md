<!--
Sync Impact Report

- Version change: TEMPLATE → 1.0.0
- Modified principles:
	- [PRINCIPLE_1_NAME] → Code Quality (NON-NEGOTIABLE)
	- [PRINCIPLE_2_NAME] → Testing Standards (NON-NEGOTIABLE)
	- [PRINCIPLE_3_NAME] → User Experience Consistency
	- [PRINCIPLE_4_NAME] → Performance Requirements
	- [PRINCIPLE_5_NAME] → Observability & Versioning
- Added sections: Development Workflow, Governance (clarified amendment + versioning policy)
- Removed sections: none
- Templates requiring updates:
	- .specify/templates/plan-template.md ⚠ pending (align "Constitution Check" with new mandatory gates)
	- .specify/templates/spec-template.md ⚠ pending (ensure "User Scenarios & Testing (mandatory)" reflects test-first policy)
	- .specify/templates/tasks-template.md ⚠ pending (task templates must reflect mandatory test tasks and performance tasks)
- Follow-up TODOs:
	- TODO(RATIFICATION_DATE): original adoption date unknown — set when ratified
	- Ensure codeowners/core maintainers review gating checklist referenced in Governance
-->

# Overleaf with Admin Extension Constitution

## Core Principles

### Code Quality (NON-NEGOTIABLE)
All code MUST be readable, well-structured, and maintainable. Enforced controls:
- Use automated linters and formatters (project standard) on every PR.
- PRs MUST be small, focused, and include a short design summary.
- Code review by at least one maintainer is REQUIRED; large or cross-cutting changes
	MUST include two reviewers and a migration or rollback plan.
- Public APIs MUST be stable, documented, and backward compatible where possible.

Rationale: High code quality reduces long-term maintenance cost and improves
onboarding speed.

### Testing Standards (NON-NEGOTIABLE)
Testing is a gate for merging. Requirements:
- Tests MUST exist for new functionality: unit tests for logic, integration/contract
	tests for service interactions, and end-to-end tests for user journeys where
	applicable.
- Tests MUST be runnable in CI and included in the PR; failing tests block merges.
- Target coverage: teams SHOULD aim for meaningful coverage thresholds (e.g.,
	critical modules ≥ 80%), but test quality is prioritized over raw percentage.
- Performance and load tests are REQUIRED for features that affect latency/throughput.

Rationale: Prevent regressions, enable refactoring, and ensure users get reliable
behavior.

### User Experience Consistency
User-facing behavior MUST be consistent across the product:
- Adhere to the shared design system and component library for layout, spacing,
	colors, and interaction patterns.
- Error states and messages MUST be clear, actionable, and consistent.
- Accessibility (WCAG AA baseline) MUST be considered for all UI work; any
	exceptions MUST be documented and temporary.
- Internationalization and time zone handling MUST be designed in for features
	that touch user-visible text or dates.

Rationale: Consistent UX reduces user confusion and support load; accessibility
is a legal and ethical requirement.

### Performance Requirements
Performance targets MUST be defined and tested for all features that affect
user-perceived latency or system throughput:
- Define SLOs/SLIs (latency p95/p99, error rate, throughput) in the spec for
	performance-sensitive features.
- Establish performance budgets and run regression benchmarks in CI for
	critical paths.
- Changes that degrade SLOs require either optimization or an explicit
	documented tradeoff approved by maintainers.

Rationale: Measurable performance goals preserve product quality at scale and
prevent regressions.

### Observability & Versioning
Every service and major library MUST provide minimal observability and follow
semantic versioning:
- Instrumentation: structured logs, key metrics, and distributed tracing where
	applicable. Alerts MUST be defined for on-callable issues.
- Semantic versioning (MAJOR.MINOR.PATCH):
	- MAJOR: incompatible API or governance changes that break consumers;
		requires migration plan and coordination.
	- MINOR: new backwards-compatible features.
	- PATCH: bug fixes and non-breaking changes.
- Deprecation window and migration guidance MUST accompany any breaking change.

Rationale: Observability reduces time-to-detect and time-to-resolve incidents;
versioning enables safe evolution of public contracts.

## Development Workflow
All development work MUST follow these gates and checks:
- Feature specs MUST include explicit user scenarios, acceptance criteria,
	and performance targets (see .specify/templates/spec-template.md).
- Plans (per .specify/templates/plan-template.md) MUST include a "Constitution
	Check" section that lists which principles apply and how they're satisfied.
- Tasks MUST be organized by user story and include test tasks for each story
	(see .specify/templates/tasks-template.md).

## Governance
Amendment and approval process:
- Amendments to this constitution are made via a documented pull request that
	includes rationale, compatibility impact, and a migration plan for affected
	artifacts.
- For non-breaking clarifications or patch-level edits, approval by one core
	maintainer is sufficient.
- For minor (policy-expanding) changes, approval by two core maintainers is
	REQUIRED.
- For major governance or principle redefinitions (backward-incompatible), a
	documented consensus from the core maintainers or steering group is
	REQUIRED and the `MAJOR` version MUST be incremented.

Compliance & review expectations:
- Every PR SHOULD include a short checklist referencing the principles that the
	change affects (code quality, tests, UX, performance, observability).
- CI MUST run the test suite and any declared performance checks; failing CI
	blocks merges.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown | **Last Amended**: 2025-12-10
*** End Patch
