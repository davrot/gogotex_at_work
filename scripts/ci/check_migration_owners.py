#!/usr/bin/env python3
"""Ensure migration readiness service docs have explicit owners.

Exits 0 when all `.specify/migrations/services/*.md` files include a non-TBD Owner.
Exits 2 and prints missing files otherwise.
"""
from pathlib import Path
import sys

MIGRATIONS_DIR = Path('.specify/migrations/services')
missing = []
for p in sorted(MIGRATIONS_DIR.glob('*.md')):
    text = p.read_text(encoding='utf-8')
    for line in text.splitlines():
        if line.startswith('Owner:'):
            owner = line.split(':', 1)[1].strip()
            if owner == '' or owner.lower().startswith('tbd'):
                missing.append(str(p))
            break
    else:
        missing.append(str(p))

if missing:
    print('Missing or TBD Owner in migration service docs:')
    for m in missing:
        print(' -', m)
    sys.exit(2)

print('All migration service docs include explicit owners.')
sys.exit(0)
