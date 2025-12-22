# LaTeX Editor (mod: `latex-editor`) ✅

- **Issue:** https://github.com/overleaf/overleaf/issues/1424
- **Author / Contact:** davrot
- **Summary:** Adds a floating LaTeX symbol palette/editor window with UI components and styling.
- **Code / Branch:** https://github.com/davrot/overleaf_with_admin_extension/tree/latex-editor
- **License:** GNU Affero GPL v3

## Status in `modz/latex-editor`

- Files present: **33** files
- Test harness: **smoke test added** (package.json + `test/smoke.test.js`) and passed locally
- Key files: frontend components (`services/web/modules/latex-editor/frontend/components/*`), `index.mjs`, stylesheet `latex-editor.scss`

## Suggested next steps

1. Add component unit tests (Vitest + React Testing Library) for toolbar & symbol palette. (P1)
2. Add accessibility tests (axe) for palette interactions and keyboard navigation. (P1)
3. Add CI job to run `npm test` for this module.

## Notes

- The issue includes a demo Docker image; module is UI-centric and benefits most from component and accessibility tests. Estimated effort: **0.5–1.5 days**.
