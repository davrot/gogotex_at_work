> **NOTE (SOLO MODE):** Solo Developer Mode is active. Do **not** create GitHub PRs, issues, or GitHub Actions workflows unless explicitly requested. Prefer providing local scripts and explicit commands for the user to run.

# overleaf_with_admin_extension Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-14

## Active Technologies

- Go 1.25 (primary for `git-bridge`), Node.js 20.x (web/profile), MongoDB 6.x, Redis 7.x, Docker Compose for local integration. (001-migrate-git-bridge-java-to-go)
- User SSH keys persisted in MongoDB (web-profile service); `git-bridge` will retrieve keys via the internal authenticated web-profile API (direct DB access from `git-bridge` is disallowed unless explicitly authorized). (001-migrate-git-bridge-java-to-go)
- Go 1.25 (git-bridge) and Node.js 18+ (web) + net/ssh (golang.org/x/crypto/ssh), system `git` binary (invoked via os/exec), Mongoose 8.x (web), MongoDB 6.x (001-migrate-git-bridge-java-to-go)
- MongoDB (`sharelatex.usersshkeys` collection) (001-migrate-git-bridge-java-to-go)

- Node.js (>=18), modern ESM and some legacy CommonJS interop + Express (web server), Mongoose (MongoDB ODM), Playwright (E2E), Vitest/Mocha (unit/contract tests), Docker Compose (dev infra), ioredis, webpack for dev frontend builds (001-ssh-git-auth-e2e)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for Node.js (>=18), modern ESM and some legacy CommonJS interop

## Code Style

Node.js (>=18), modern ESM and some legacy CommonJS interop: Follow standard conventions

## Recent Changes

- 001-migrate-git-bridge-java-to-go: Added Go 1.21 (git-bridge) and Node.js 18+ (web) + net/ssh (golang.org/x/crypto/ssh), system `git` binary (invoked via os/exec), Mongoose 8.x (web), MongoDB 6.x
- 001-migrate-git-bridge-java-to-go: Added Go 1.25 (primary for `git-bridge`), Node.js 20.x (web/profile), MongoDB 6.x, Redis 7.x, Docker Compose for local integration.

- 001-ssh-git-auth-e2e: Added Node.js (>=18), modern ESM and some legacy CommonJS interop + Express (web server), Mongoose (MongoDB ODM), Playwright (E2E), Vitest/Mocha (unit/contract tests), Docker Compose (dev infra), ioredis, webpack for dev frontend builds

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
