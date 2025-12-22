# Sandbox Compile (mod: `sandbox-compile`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1430
- **Author / Contact:** davrot
- **Summary:** Replace local TexLive installs with Docker-based sandboxed compiles (CLSI service), pre-pull helper scripts, and configuration for allowed TeX Live images. Includes thorough docs and quick-start in issue body.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/sandbox-compile
- **License:** GNU Affero GPL v3

## Status in `modz/sandbox-compile`

- Files present: **45** files
- Test harness: **smoke test added** (package.json + `test/smoke.test.js`) and passed locally
- Key files: `services/clsi/app.js`, `server-ce/Dockerfile`, health checks and helper script `bin/pre-pull-texlive-images.sh`

## Suggested next steps

1. Make existing `services/clsi` smoke/unit tests runnable in CI (validate required env vars and optional Docker mocking). (P1)
2. Add integration tests for health-check endpoints and param validation using `supertest`. (P2)
3. Document required host volumes and Docker socket setup in `MOD_INFO.md` to help reviewers verify in a local/dev environment.

## Notes

- The module is well-documented in the issue (Quick User Guide). It needs careful CI / environment setup to exercise the Docker-related checks; estimated effort: **2–4 days** for robust test coverage and CI integration.
