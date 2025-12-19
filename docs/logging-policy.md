# Logging policy — masking, retention, and PII handling

This document describes the project policy for structured logs that may contain sensitive or PII-like data (for example, tokens, token prefixes, SSH fingerprints, user identifiers) and explains masking, retention windows, access controls, and testing that must be applied to the `web` and `git-bridge` services.

Principles

- Minimize risk: never log full secret material (plaintext tokens, full secret hashes, private keys). Log only the minimal information necessary for auditing and debugging.
- Mask by default: logs that relate to sensitive resources MUST expose a short, non-reversible identifier (`hashPrefix`) instead of a full secret or hash.
- Retention and access control must be explicit and documented, and logs containing sensitive metadata must be access-restricted and audited.

Event schema and masking rules

- Use the authoritative schema at `services/web/lib/log-schemas/auth-events.json`.
- Required fields: `event`, `service`, `level`, `timestamp`, `action`, `outcome`.
- For token-related events (e.g., `token.create`, `token.introspect`, `token.revoked`):
  - DO NOT log full token strings.
  - DO log `hashPrefix` — exactly the first 8 hex characters of the lowercased SHA256 of the token (e.g., `9f86d081`). This is sufficient to correlate events with tokens without exposing secret material.
  - DO log `resourceId` (token id) or `hashPrefix` where appropriate; prefer `hashPrefix` for correlation in audit logs to avoid exposing database ids when unnecessary.
- For SSH key events, record `fingerprint` in the canonical form `SHA256:<base64>`; public keys themselves SHOULD NOT be logged unless strictly necessary for diagnostics, and must be access-restricted.
- For any event, redact or avoid logging any full secret material, including headers, form bodies or debug dumps that might contain tokens.

Retention windows & archival (recommended defaults)

- Audit logs (structured auth events such as `auth.ssh_attempt`, `token.introspect`, `token.create`) — **retain at least 90 days** for operational troubleshooting and compliance; consider longer (365 days) for regulatory requirements.
- Sensitive payloads (if any are stored, e.g., in debug dump archives) — **retain only as long as necessary**, with explicit approval and audit trail; default to **30 days** and then securely delete.
- Log rotation/compression: follow platform best practices and ensure logs are archived with integrity checks and access control (S3 with restricted bucket policies or a managed logging solution with RBAC).

Access control & monitoring

- Access to raw logs containing token or fingerprint identifiers must be restricted to a small set of operators.
- All access to raw logs must be audited (who accessed, why, and when).
- Use RBAC and short-lived credentials when querying logs in production and avoid downloading bulk raw logs unless required for an investigation.

Testing & verification

- Validate emitted logs against the JSON schema using `services/web/test/contract/LogSchemaValidationTests.mjs`.
- Verify `token.introspect` and audit events include `hashPrefix` and do not include plaintext tokens using `services/web/test/contract/LoggingRetentionPIITests.mjs`.
- Add and run contract tests that assert masking and retention behaviors as part of CI. (There are contract test skeletons in `services/web/test/contract/` — extend them to assert retention behavior for your deployment environment.)
  - The `LoggingRetentionPIITests` contract test will check for an environment-configured retention value (e.g., `AUDIT_LOG_RETENTION_DAYS` or `Settings.auditLogRetentionDays`) and assert it is at least **90** days; if no such configuration is present the test will skip and act as a scaffold/reminder to configure retention in that environment.

Operational guidance

- Configure log shipping to a centralized system that supports indexing, RBAC, and audit trails (e.g., ELK stack, Splunk, or a managed logging service).
- In development and test environments, avoid logging plaintext tokens and secrets; enable stricter scrubbing in lower-trust environments.

Policy change process

- Any change to masking rules, retention windows, or who may access logs must be made via a documented PR, include a rationale, impact analysis, and a migration/rollback plan if the change affects data retention.
- Update `docs/logging-policy.md` and relevant contract tests when policy changes are introduced.

Contact

- For questions about this policy or access to logs, contact the platform/ops team or raise an issue and tag `#security` and `#platform` in the internal tracker.
