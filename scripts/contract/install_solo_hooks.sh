#!/usr/bin/env bash
set -euo pipefail

# Install pre-commit hook to enforce solo-developer guardrails
HOOK_DIR=".git/hooks"
if [ ! -d "$HOOK_DIR" ]; then
  echo "No .git/hooks directory found. Are you in a git repo?"
  exit 1
fi

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/usr/bin/env bash
# Prevent accidental workflow edits in solo mode
scripts/contract/check_prevent_workflow_changes.sh || exit 1
HOOK

chmod +x "$HOOK_DIR/pre-commit"
echo "Installed pre-commit hook to prevent workflow changes unless ALLOW_WORKFLOW_CHANGES=true"
