#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess

# Setup: write a summary.json with thresholds exceeded
Path('ci/flakiness/cross').mkdir(parents=True, exist_ok=True)
summary = {'run_total':2,'run_failures':1,'iter_total':10,'iter_failures':1}
Path('ci/flakiness/cross/summary.json').write_text(json.dumps(summary))

# Run generator CLI
subprocess.run(['python3','scripts/contract/generate_status_badge.py','--out','ci/flakiness/cross/status_cli.svg'], check=True)
assert Path('ci/flakiness/cross/status_cli.svg').exists()
print('status_cli.svg exists')

# Now write a status.json with explicit threshold_exceeded=false
Path('ci/flakiness/cross/status.json').write_text(json.dumps({'threshold_exceeded': False}))
subprocess.run(['python3','scripts/contract/generate_status_badge.py','--out','ci/flakiness/cross/status_ok.svg'], check=True)
print('status_ok.svg exists')
assert Path('ci/flakiness/cross/status_ok.svg').exists()

# write status.json with threshold_exceeded true
Path('ci/flakiness/cross/status.json').write_text(json.dumps({'threshold_exceeded': True}))
subprocess.run(['python3','scripts/contract/generate_status_badge.py','--out','ci/flakiness/cross/status_alert.svg'], check=True)
print('status_alert.svg exists')
assert Path('ci/flakiness/cross/status_alert.svg').exists()

print('CLI tests passed')
