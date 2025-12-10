check-prerequisites.sh
----------------------

Purpose
-------
Small helper to verify the presence of a feature directory and required spec/plan/tasks documents and emit a JSON summary for CI.

Quick usage
-----------
Run from the repository root (the script auto-detects repo root via git when possible):

```bash
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Output
------
When `--json` is used the script prints JSON with `FEATURE_DIR` (absolute path) and `AVAILABLE_DOCS` (array of present docs). Exit codes: 0 OK, 3 missing .specify, 4 missing feature dir, 5 missing required docs.
