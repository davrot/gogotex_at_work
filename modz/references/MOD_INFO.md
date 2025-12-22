# References / Cite Manager (mod: `references`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1429
- **Author / Contact:** davrot
- **Summary:** Reference picker / cite manager UI (Ctrl+Space inside `\cite{}`), supports multiple selections and ordering. Branch and Docker image provided for testing.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/references
- **License:** GNU Affero GPL v3

## Status in `modz/references`

- Files present: **20** files (frontend components, indexer & worker, styles, translations)
- Test harness: **no package.json/tests present** (module currently lacks test coverage in `modz`)
- Key files: `services/web/frontend/js/features/ide-react/references/*`, `reference-indexer.ts`, `references.worker.ts`

## Suggested next steps

1. Add unit tests for `ReferenceIndexer` (mock `ProjectSnapshot` and worker messages). (P1)
2. Add worker tests (simulate worker messages & responses) and simple component tests. (P2)
3. Add `package.json` and CI test job for the module. (P2)

## Notes

- Module includes both worker logic and UI; focus tests on indexing correctness and search/list behavior. Estimated effort: **1–2 days**.
