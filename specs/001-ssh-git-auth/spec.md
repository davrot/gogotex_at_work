```markdown
# Feature Specification: SSH-only Git authentication for git-bridge

**Feature Branch**: `001-ssh-git-auth`  
**Created**: 2025-12-10  
**Status**: Draft

**Naming (branding)**: Throughout this migration we'll use the label **GoGoTeX** to refer to Go-based replacements of Overleaf backend components (for example, `git-bridge` → `git-bridge-go` or `web-profile` → `web-profile-gogotex`). Use the **GoGoTeX** label in documentation, service names, and image tags to clearly indicate migrated components.

**Input**: User stories and functional requirements provided by product/security team: implement SSH-only Git authentication in `git-bridge`, remove legacy HTTP/OAuth2 auth, add SSH key management in UI and storage, validate SSH keys via the internal web-profile API, reject deprecated auth methods silently, and log security events for auditing.

## Clarifications

### Session 2025-12-10

- Q: Should `git-bridge` fetch SSH public keys directly from MongoDB or via an internal API to the web-profile service? → A: Internal authenticated API to the web-profile service (preferred). `git-bridge` MUST call the internal API to retrieve user SSH keys; direct DB access is disallowed unless explicitly authorized.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - SSH Git access (Priority: P1)

As an Overleaf user, I want to access my Git repositories using SSH keys so that I can securely collaborate without exposing passwords.

**Why this priority**: Critical security enhancement that replaces vulnerable password-based auth.

**Independent Test**: Add a valid public SSH key to the user's account, attempt `git clone`/`git push` over SSH using that key, and verify operations succeed while password-based attempts fail.

**Acceptance Scenarios**:

1. **Given** a user with a registered SSH public key, **When** they connect via SSH to a project repository, **Then** the SSH authentication succeeds and Git operations proceed.
2. **Given** a user without a registered SSH key, **When** they attempt SSH Git operations, **Then** authentication fails.

---

### User Story 2 - Remove legacy API & auth (Priority: P1)

As a system administrator, I want legacy API components and HTTP/OAuth2 authentication mechanisms removed so that known security vulnerabilities are eliminated.

**Why this priority**: Eliminates critical attack surface from deprecated and insecure components.

**Independent Test**: Deploy git-bridge with legacy endpoints removed; exercise previously supported HTTP Basic / OAuth2 authentication flows and verify they are rejected (and produce no informative error that betrays the previous functionality).

**Acceptance Scenarios**:

1. **Given** a request using HTTP Basic Auth, **When** it targets git-bridge, **Then** the request is rejected and the response gives no indication that HTTP Basic was ever supported.
2. **Given** a request using OAuth2 tokens, **When** it targets git-bridge, **Then** the request is rejected in the same opaque manner.

---

### User Story 3 - SSH key management UI (Priority: P2)

As an Overleaf user, I want to manage my SSH keys in the Overleaf web UI so that I can control my Git access credentials from a central place.

**Why this priority**: Improves UX and reduces support overhead; however SSH-only auth must be implemented before full UI rollout.

**Independent Test**: From the account settings page, add a valid SSH public key; verify it is persisted in MongoDB, visible in the UI list, and usable for SSH authentication.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they add a valid SSH public key via the UI, **Then** the key is saved and available for SSH authentication.
2. **Given** a logged-in user, **When** they delete/revoke a key in the UI, **Then** subsequent SSH attempts using that key fail.

---

### Edge Cases

- Malformed or truncated SSH public keys — UI/validation must reject and log attempts.
- Duplicate keys across users — system should detect duplicates and either allow (with audit) or reject per policy (see Assumptions).
- Key rotation: user uploads replacement key and revokes old key; simultaneous sessions should be handled.
- Exported/archived projects: ensure recorded authorized_keys mapping persists for archived repos.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Remove all HTTP/S and OAuth2 authentication mechanisms from `git-bridge` and ensure no codepath accepts HTTP Basic Auth or OAuth2 tokens for Git operations.
- **FR-002**: Implement SSH-based Git authentication exclusively for all Git operations handled by `git-bridge`.
- **FR-003**: Remove all references to legacy/deprecated APIs and components (including OAuth2 filter and related modules) from the `git-bridge` codebase and configuration.
- **FR-004 (consolidated)**: SSH key retrieval and storage MUST be handled via the internal authenticated WebProfile API. `git-bridge` MUST call `WebProfileClient.getUserSSHKeys(userId)` (or equivalent) to obtain the authoritative list of public keys for a user; direct DB reads by `git-bridge` are disallowed unless explicitly authorized and documented. The web service MUST persist SSH key records under the user's profile (attributes: `user_id`, `key_name`, `public_key`, `fingerprint`, `private_key_hash` (optional, non-reversible), `created_at`, `updated_at`).
- **FR-005 (clarified)**: Deprecated auth attempts (HTTP Basic, OAuth2) MUST be rejected with a consistent, opaque response: HTTP 401, `Content-Type: application/json`, and body `{"error":"unauthorized"}`. The response MUST not leak which auth methods were supported historically. Security logs MUST record an event with fields: `event="deprecated_auth_attempt"`, `method="http-basic|oauth2"`, `source_ip`, `user_agent`, `timestamp`, and a correlation id; logs MUST NOT contain passwords, tokens, or private key material.
- **FR-006**: Log security-relevant events related to authentication attempts (successful SSH auth, failed SSH auth, attempted use of deprecated methods) with sufficient context for audit trails while avoiding sensitive data leakage.
- **FR-007**: Ensure compatibility with the Overleaf development environment: Docker environment variables, build scripts, and container restart workflow must continue to work for `git-bridge` development and debugging.
- **FR-009**: Provide UI components in the web UI for adding, listing, and revoking SSH public keys from the user's account settings; these UI changes are part of this feature's scope and must be wired to storage.
- **FR-010**: Ensure private keys are never stored in full plaintext; only public keys and optional hashed metadata (`private_key_hash`) are stored as described in Assumptions.

**Duplicate-key policy**: Key fingerprint MUST be globally unique across users. Adding a public key whose fingerprint already exists:

- if owned by the same user → idempotent: return HTTP 200 and the existing key resource (no duplicate created).
- if owned by a different user → reject with HTTP 409 Conflict and a structured audit log event: `event="ssh_key_conflict"`, `fingerprint`, `existing_user_id`, `attempted_user_id`, `timestamp`.

**Acceptance**: Add a test that attempts to POST a private key payload to the SSH key API and verifies the API returns 4xx and that no private key material is present in the DB, logs, or artifacts. (See task T034.)

### Key Entities

- **SSH Key**: Represents a user's public key entry.
  - Attributes: `user_id`, `key_name`, `public_key` (OpenSSH format), `private_key_hash` (optional metadata/hash), `created_at`, `updated_at`.
- **Git Repository Access**: Mapping for project-level access.
  - Attributes: `project_id`, `user_id`, `access_type` (`SSH`), `authorized_keys` (list of SSH Key IDs or fingerprints).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of user Git authentication requests in production/staging must use SSH keys; HTTP Basic and OAuth2 authentication requests are rejected and logged.
- **SC-002**: All legacy OAuth2 endpoints and filters referenced in `git-bridge` are removed from the codebase and configuration (verified by code scan / grep for known identifiers).
- **SC-003**: For small test repositories (<= 1MB, <= 10 files), the end-to-end **p95** latency for `git clone` and `git push` must be < **2s**, and **p99** < **10s** under normal load. Integration and performance tests must measure these percentiles and record them to CI artifacts for verification.
- **SC-004**: Security logging records authentication events with enough detail to identify user_id, key fingerprint, timestamp, and request outcome in ≥95% of cases.
- **SC-005**: No production logs, responses, or UI elements reveal sensitive material such as private keys or detailed failure modes of deprecated auth methods.

## Testing Strategy

- Unit tests for SSH key parsing and validation routines.
- Integration tests that:
  - verify SSH auth succeeds for valid registered keys (end-to-end with `git-bridge` handling a test repo);
  - verify SSH auth fails for revoked/missing/invalid keys;
  - verify HTTP Basic and OAuth2 authentication attempts are rejected and produce opaque responses.
- Contract tests between `git-bridge` and user-profile service (API or MongoDB schema) for key retrieval.
- Performance test for common Git operations (clone/push) on a representative repo to capture p95 latency before/after changes.

-## Assumptions

- User public SSH keys are stored in the web-profile service (persisted in MongoDB) and are accessible to internal services via an authenticated internal API provided by the web-profile service. `git-bridge` MUST retrieve keys using that API; direct DB access from `git-bridge` is disallowed unless explicitly authorized.
- Private keys are not stored; `private_key_hash` is an optional metadata field for diagnostics and must not be reversible.
- Existing CI/deployment tooling can be updated to run new integration/performance tests for this feature.
- Backwards compatibility: removing legacy endpoints is acceptable and coordinated with integrators; any external integrations relying on removed APIs must be migrated prior to rollout.

## Rollout Plan (high level)

1. Implement SSH authentication and SSH key retrieval logic behind feature flag in staging.
2. Deploy UI components to staging (UI hidden behind feature flag) and validate end-to-end flows with test accounts.
3. Disable legacy HTTP/OAuth2 endpoints in staging and run regression and security scans.
4. After validation, schedule coordinated production rollout with communication and migration guidance for integrators.

## Implementation Notes

- Follow the constitution gates: include a "Constitution Check" section in the plan documenting how code quality, testing, UX consistency, performance, and observability are addressed.
- Ensure all code changes include unit/integration tests and CI configuration updates to run the new tests.
```
