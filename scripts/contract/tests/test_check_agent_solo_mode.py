#!/usr/bin/env python3
import subprocess
from pathlib import Path

# Ensure test can run even if repo is modified
Path('ci/tmp').mkdir(parents=True, exist_ok=True)
res = subprocess.run(['python3','scripts/contract/check_agent_solo_mode.py'], capture_output=True, text=True)
print(res.stdout)
if res.returncode != 0:
    print('Checker failed; see output above')
    raise SystemExit(1)
print('Checker OK')
