# Constitution Amendment: Solo Developer Mode (v1.1.0)

**Amendment Type**: MINOR (policy-expanding)  
**Status**: DRAFT → Apply immediately to override team-oriented requirements  
**Ratified**: 2025-12-22

## Problem Statement

The base constitution (v1.0.0) assumes team collaboration with GitHub PRs, CI/CD infrastructure, and multiple reviewers. For solo development with AI assistants (Copilot, Claude, etc.), these requirements create overhead without benefit:

- Creating PRs when there's no human reviewer wastes time
- GitHub Actions workflows consume credits unnecessarily
- Escalating to GitHub Support for infrastructure issues is inappropriate for solo projects

## Solo Developer Override Rules

### Code Quality (ADAPTED)

- **PR requirement WAIVED** for solo developers
- Instead: Maintain clean commit messages and logical commit boundaries
- AI assistants MUST NOT create GitHub PRs, issues, or workflows unless explicitly requested
- Code review happens through direct review with AI assistant in chat/editor

### Testing Standards (ADAPTED)

- Tests still REQUIRED but CI/CD is OPTIONAL
- Run tests locally: `npm test`, `pytest`, etc.
- AI assistants MUST provide commands to run tests locally, not GitHub Actions workflows
- For solo projects: "CI MUST run tests" → "Tests MUST be runnable locally and passing"

### Development Workflow (ADAPTED)

- Constitution checks remain but are conversational, not GitHub artifacts
- Specs and plans can be markdown files in `.specify/` or chat-based
- No GitHub issues required; track work in local TODO.md or chat context

### Infrastructure Automation (NEW RULE)

AI assistants working with solo developers MUST:

- ❌ NOT create GitHub Actions workflows without explicit permission
- ❌ NOT open GitHub issues or PRs automatically
- ❌ NOT escalate to external support (GitHub Support, etc.)
- ✅ Provide local scripts and commands instead
- ✅ Ask before creating any GitHub-hosted automation

### When Team Mode Applies

Use full team requirements when:

- Multiple human contributors are active
- The project has dedicated CI/CD infrastructure (free tier or paid)
- External collaborators need formal review process

## Migration for Existing Projects

1. Add this amendment file to `.specify/constitution-solo-mode.md`
2. Update `.specify/ai-context.md` with: "This is a solo developer project. Follow solo developer mode from the constitution."
3. Instruct AI assistants: "Do not create GitHub PRs, issues, or workflows. Provide local commands instead."

## Explicit Instruction for AI Assistants

If you are Copilot, Claude, or another AI working on this project:

- You are working with a SOLO DEVELOPER
- Do NOT create PRs on GitHub
- Do NOT create or trigger GitHub Actions workflows
- Do NOT open issues or escalate to external support
- INSTEAD: Help run tests locally, suggest improvements in chat, maintain code quality through direct collaboration

**Version**: 1.1.0 (MINOR update to 1.0.0)  
**Supersedes**: Team-oriented requirements in v1.0.0 for solo contexts
