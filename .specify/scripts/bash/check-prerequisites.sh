#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<EOF
Usage: check-prerequisites.sh [OPTIONS] [FEATURE_DIR]

Options:
  --json             Emit machine-readable JSON output
  --require-tasks    Require at least spec.md and plan.md in feature dir
  --include-tasks    Also require tasks.md when present
  -h, --help         Show this help message

If FEATURE_DIR positional is provided it will be used instead of auto-detection.
EOF
}

JSON=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
POS_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=true; shift;;
    --require-tasks) REQUIRE_TASKS=true; shift;;
    --include-tasks) INCLUDE_TASKS=true; shift;;
    -h|--help) print_help; exit 0;;
    --) shift; break;;
    -* ) echo "Unknown option: $1" >&2; print_help; exit 2;;
    *) POS_ARG="$1"; shift;;
  esac
done

# Exit code map:
# 0 OK
# 2 usage error
# 3 missing .specify
# 4 missing feature dir
# 5 missing required docs

repo_root=""
if command -v git >/dev/null 2>&1; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
  fi
fi
if [ -z "$repo_root" ]; then
  repo_root=$(pwd)
fi

spec_dir="$repo_root/.specify"
if [ ! -d "$spec_dir" ]; then
  echo "Error: .specify directory not found under repo root: $repo_root" >&2
  exit 3
fi

# Determine feature dir
feature_dir=""
if [ -n "$POS_ARG" ]; then
  feature_dir="$POS_ARG"
  if [ ! -d "$feature_dir" ]; then
    # try relative to repo_root
    if [ -d "$repo_root/$feature_dir" ]; then
      feature_dir="$repo_root/$feature_dir"
    fi
  fi
fi

if [ -z "$feature_dir" ] && [ -n "${FEATURE_DIR-}" ]; then
  feature_dir="$FEATURE_DIR"
fi

if [ -z "$feature_dir" ]; then
  # Auto-detect under .specify/features/
  features_parent="$spec_dir/features"
  if [ -d "$features_parent" ]; then
    count=$(find "$features_parent" -mindepth 1 -maxdepth 1 -type d | wc -l)
    if [ "$count" -eq 1 ]; then
      feature_dir=$(find "$features_parent" -mindepth 1 -maxdepth 1 -type d)
    fi
  fi
fi

if [ -z "$feature_dir" ]; then
  echo "Error: FEATURE_DIR not set and auto-detection failed; provide positional FEATURE_DIR or set FEATURE_DIR env var" >&2
  exit 4
fi

# Normalize to absolute path
feature_dir=$(cd "$feature_dir" && pwd -P)

AVAILABLE_DOCS=()
for f in spec.md plan.md tasks.md; do
  if [ -f "$feature_dir/$f" ]; then
    AVAILABLE_DOCS+=("$f")
  fi
done

missing_required=0
if [ "$REQUIRE_TASKS" = true ]; then
  for r in spec.md plan.md; do
    if [ ! -f "$feature_dir/$r" ]; then
      missing_required=1
    fi
  done
fi
if [ "$INCLUDE_TASKS" = true ]; then
  if [ ! -f "$feature_dir/tasks.md" ]; then
    missing_required=1
  fi
fi

if [ "$JSON" = true ]; then
  # Emit JSON with FEATURE_DIR absolute and AVAILABLE_DOCS array
  docs_json="["
  first=true
  for d in "${AVAILABLE_DOCS[@]}"; do
    if [ "$first" = true ]; then
      docs_json+="\"$d\""
      first=false
    else
      docs_json+=",\"$d\""
    fi
  done
  docs_json+="]"

  printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":%s}' "$feature_dir" "$docs_json"
  if [ "$missing_required" -ne 0 ]; then
    echo
    exit 5
  else
    echo
    exit 0
  fi
else
  echo "FEATURE_DIR: $feature_dir"
  if [ ${#AVAILABLE_DOCS[@]} -gt 0 ]; then
    echo "AVAILABLE_DOCS: ${AVAILABLE_DOCS[*]}"
  else
    echo "AVAILABLE_DOCS: (none)"
  fi
  if [ "$missing_required" -ne 0 ]; then
    echo "Error: missing required docs" >&2
    exit 5
  fi
fi
#!/usr/bin/env bash

# Consolidated prerequisite checking script
#
# This script provides unified prerequisite checking for Spec-Driven Development workflow.
# It replaces the functionality previously spread across multiple scripts.
#
# Usage: ./check-prerequisites.sh [OPTIONS]
#
# OPTIONS:
#   --json              Output in JSON format
#   --require-tasks     Require tasks.md to exist (for implementation phase)
#   --include-tasks     Include tasks.md in AVAILABLE_DOCS list
#   --paths-only        Only output path variables (no validation)
#   --help, -h          Show help message
#
# OUTPUTS:
#   JSON mode: {"FEATURE_DIR":"...", "AVAILABLE_DOCS":["..."]}
#   Text mode: FEATURE_DIR:... \n AVAILABLE_DOCS: \n ✓/✗ file.md
#   Paths only: REPO_ROOT: ... \n BRANCH: ... \n FEATURE_DIR: ... etc.

set -e

# Parse command line arguments
JSON_MODE=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
PATHS_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --require-tasks)
            REQUIRE_TASKS=true
            ;;
        --include-tasks)
            INCLUDE_TASKS=true
            ;;
        --paths-only)
            PATHS_ONLY=true
            ;;
        --help|-h)
            cat << 'EOF'
Usage: check-prerequisites.sh [OPTIONS]

Consolidated prerequisite checking for Spec-Driven Development workflow.

OPTIONS:
  --json              Output in JSON format
  --require-tasks     Require tasks.md to exist (for implementation phase)
  --include-tasks     Include tasks.md in AVAILABLE_DOCS list
  --paths-only        Only output path variables (no prerequisite validation)
  --help, -h          Show this help message

EXAMPLES:
  # Check task prerequisites (plan.md required)
  ./check-prerequisites.sh --json
  
  # Check implementation prerequisites (plan.md + tasks.md required)
  ./check-prerequisites.sh --json --require-tasks --include-tasks
  
  # Get feature paths only (no validation)
  ./check-prerequisites.sh --paths-only
  
EOF
            exit 0
            ;;
        *)
            echo "ERROR: Unknown option '$arg'. Use --help for usage information." >&2
            exit 1
            ;;
    esac
done

# Source common functions
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get feature paths and validate branch
eval $(get_feature_paths)
check_feature_branch "$CURRENT_BRANCH" "$HAS_GIT" || exit 1

# If paths-only mode, output paths and exit (support JSON + paths-only combined)
if $PATHS_ONLY; then
    if $JSON_MODE; then
        # Minimal JSON paths payload (no validation performed)
        printf '{"REPO_ROOT":"%s","BRANCH":"%s","FEATURE_DIR":"%s","FEATURE_SPEC":"%s","IMPL_PLAN":"%s","TASKS":"%s"}\n' \
            "$REPO_ROOT" "$CURRENT_BRANCH" "$FEATURE_DIR" "$FEATURE_SPEC" "$IMPL_PLAN" "$TASKS"
    else
        echo "REPO_ROOT: $REPO_ROOT"
        echo "BRANCH: $CURRENT_BRANCH"
        echo "FEATURE_DIR: $FEATURE_DIR"
        echo "FEATURE_SPEC: $FEATURE_SPEC"
        echo "IMPL_PLAN: $IMPL_PLAN"
        echo "TASKS: $TASKS"
    fi
    exit 0
fi

# Validate required directories and files
if [[ ! -d "$FEATURE_DIR" ]]; then
    echo "ERROR: Feature directory not found: $FEATURE_DIR" >&2
    echo "Run /speckit.specify first to create the feature structure." >&2
    exit 1
fi

if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "ERROR: plan.md not found in $FEATURE_DIR" >&2
    echo "Run /speckit.plan first to create the implementation plan." >&2
    exit 1
fi

# Check for tasks.md if required
if $REQUIRE_TASKS && [[ ! -f "$TASKS" ]]; then
    echo "ERROR: tasks.md not found in $FEATURE_DIR" >&2
    echo "Run /speckit.tasks first to create the task list." >&2
    exit 1
fi

# Build list of available documents
docs=()

# Always check these optional docs
[[ -f "$RESEARCH" ]] && docs+=("research.md")
[[ -f "$DATA_MODEL" ]] && docs+=("data-model.md")

# Check contracts directory (only if it exists and has files)
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    docs+=("contracts/")
fi

[[ -f "$QUICKSTART" ]] && docs+=("quickstart.md")

# Include tasks.md if requested and it exists
if $INCLUDE_TASKS && [[ -f "$TASKS" ]]; then
    docs+=("tasks.md")
fi

# Output results
if $JSON_MODE; then
    # Build JSON array of documents
    if [[ ${#docs[@]} -eq 0 ]]; then
        json_docs="[]"
    else
        json_docs=$(printf '"%s",' "${docs[@]}")
        json_docs="[${json_docs%,}]"
    fi
    
    printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":%s}\n' "$FEATURE_DIR" "$json_docs"
else
    # Text output
    echo "FEATURE_DIR:$FEATURE_DIR"
    echo "AVAILABLE_DOCS:"
    
    # Show status of each potential document
    check_file "$RESEARCH" "research.md"
    check_file "$DATA_MODEL" "data-model.md"
    check_dir "$CONTRACTS_DIR" "contracts/"
    check_file "$QUICKSTART" "quickstart.md"
    
    if $INCLUDE_TASKS; then
        check_file "$TASKS" "tasks.md"
    fi
fi
