#!/usr/bin/env bash
# Verify each services/*-go has README_POC.md, Makefile, and ci/ci-snippet.template
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
failed=0
for d in "$ROOT"/services/*-go; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  echo "Checking $name"
  if [ ! -f "$d/README_POC.md" ]; then
    echo "  MISSING: README_POC.md"
    failed=1
  fi
  if [ ! -f "$d/Makefile" ]; then
    echo "  MISSING: Makefile"
    failed=1
  fi
  if [ ! -f "$d/ci/ci-snippet.template" ]; then
    echo "  MISSING: ci/ci-snippet.template"
    failed=1
  fi
done
exit $failed