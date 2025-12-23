#!/usr/bin/env python3
"""Check migration readiness docs exist for services with Go modules.

Exits 0 if all services with go.mod have a corresponding
`.specify/migrations/services/<service>.md` file. Exits 2 and prints missing
services otherwise.
"""
from pathlib import Path
import sys

ROOT = Path('.')
SERVICES_DIR = ROOT / 'services'
MIGRATIONS_DIR = ROOT / '.specify' / 'migrations' / 'services'

services = sorted(p.name for p in SERVICES_DIR.iterdir() if p.is_dir())
missing = []
for s in services:
    if (ROOT / 'services' / s / 'go.mod').exists():
        doc = MIGRATIONS_DIR / f'{s}.md'
        if not doc.exists():
            missing.append(s)

if missing:
    print('Missing migration readiness docs for services:')
    for m in missing:
        print(' -', m)
    sys.exit(2)

print('All Go services have migration readiness docs.')
sys.exit(0)
