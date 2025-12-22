# Logo Tools (mod: `logo-tools`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1418
- **Author / Contact:** davrot
- **Summary:** Simple tooling to generate icons/favicons and multiple logo variants from provided SVG sources. Intended to help site admins swap branding easily.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/logo-tools
- **License:** GNU Affero GPL v3 (as stated in issue)

## Status in `modz/logo-tools`

- Files present under `modz/logo-tools/logo_tools/` (8 utility scripts + README)
- Test harness: **none** yet (no `package.json` or tests)
- Key files: `logo_tools/generate_icons.py`, `generate_favicons.py`, `create_sw_versions.py`, shell helpers

## Suggested next steps

1. Add smoke tests that run the Python scripts with a small sample input and assert expected output files. (P1)
2. Add a basic `Makefile` or `package.json` script that CI can call to run smoke tests. (P2)

## Notes

- This module is low-risk and ideal for quick win automation (small targeted tests).
- Estimated effort: **0.5–1 day** to add smoke tests & CI job.
