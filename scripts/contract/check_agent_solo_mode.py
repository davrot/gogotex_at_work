#!/usr/bin/env python3
"""
Scan agent guidance files in `.github/agents/` to ensure solo-mode reminder exists.
Exits with non-zero code if any agent file is missing the reminder.
"""
from pathlib import Path
import sys

AGENTS_DIR = Path('.github/agents')
REMINDER = 'Solo Developer Mode is active.'

missing = []
for p in sorted(AGENTS_DIR.glob('*.md')):
    text = p.read_text(encoding='utf-8')
    if REMINDER not in text:
        missing.append(str(p))

if missing:
    print('Missing solo-mode reminder in the following agent files:')
    for m in missing:
        print(' -', m)
    sys.exit(2)

print('All agent files include Solo-mode reminder.')
sys.exit(0)
