#!/usr/bin/env python3
import subprocess
import sys

ret = subprocess.run(['python3', 'scripts/ci/check_migration_readiness.py'], capture_output=True, text=True)
print(ret.stdout)
if ret.returncode != 0:
    print('Checker failed', file=sys.stderr)
    sys.exit(1)
print('Checker OK')
