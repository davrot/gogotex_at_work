---
description: Convert existing tasks into actionable, dependency-ordered GitHub issue *templates* for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

> **NOTE (SOLO MODE):** Solo Developer Mode is active. **Do not** create GitHub issues automatically. Instead produce ready-to-paste issue templates or an artifacts file the user can use to create issues manually. If explicit permission is given (ALOW_ISSUE_CREATION=true), then creating issues may proceed.


## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
1. From the executed script, extract the path to **tasks**.
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

1. For each task in the list, **do NOT create issues automatically**. Instead, generate an issue template (title, body, labels, assignees) for each task and write them to `ci/task-issues/` as JSON and Markdown files suitable for manual review and bulk import.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL. Also, do not create issues automatically unless explicitly authorized by the user (set `ALLOW_ISSUE_CREATION=true`).
