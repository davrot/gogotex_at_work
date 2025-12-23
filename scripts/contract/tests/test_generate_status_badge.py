#!/usr/bin/env python3
from pathlib import Path
import json

# prepare a sample status
Path('ci/flakiness/cross').mkdir(parents=True, exist_ok=True)
Path('ci/flakiness/cross/status.json').write_text(json.dumps({'threshold_exceeded': False, 'summary': {}}))

import subprocess
subprocess.run(['python3', 'scripts/contract/generate_status_badge.py'], check=True)
assert Path('ci/flakiness/cross/status.svg').exists()
print('status badge generated OK')
