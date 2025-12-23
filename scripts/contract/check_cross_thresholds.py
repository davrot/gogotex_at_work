#!/usr/bin/env python3
"""
Check cross-instance flakiness summary against configured thresholds.
Writes exit code 0 when thresholds NOT exceeded, 2 when exceeded, 1 on error.
Environment variables:
 - CROSS_RUN_FAIL_THRESHOLD (int, default 1): number of runs with failures that triggers alert
 - CROSS_ITER_FAILURE_RATE_THRESHOLD (float, default 0.05): fraction of iterations failed across aggregated runs that triggers alert (e.g., 0.05 for 5%)
"""
import json
import os
import sys
from pathlib import Path

SUMMARY_PATH = Path('ci/flakiness/cross/summary.json')
if not SUMMARY_PATH.exists():
    print('No summary.json present at', SUMMARY_PATH)
    sys.exit(1)

try:
    summary = json.loads(SUMMARY_PATH.read_text())
except Exception as e:
    print('Failed to read summary.json:', e)
    sys.exit(1)

run_failures = int(summary.get('run_failures', 0))
run_total = int(summary.get('run_total', 0))
iter_failures = int(summary.get('iter_failures', 0))
iter_total = int(summary.get('iter_total', 0))

# thresholds
run_threshold = int(os.environ.get('CROSS_RUN_FAIL_THRESHOLD', '1'))
iter_rate_threshold = float(os.environ.get('CROSS_ITER_FAILURE_RATE_THRESHOLD', '0.05'))

iter_rate = 0.0 if iter_total == 0 else iter_failures / iter_total

print('Cross summary: runs=%d run_failures=%d iter_total=%d iter_failures=%d iter_rate=%.4f' % (run_total, run_failures, iter_total, iter_failures, iter_rate))
print('Thresholds: run_failures>=%d or iter_rate>=%s' % (run_threshold, iter_rate_threshold))

# decide
if run_failures >= run_threshold or iter_rate >= iter_rate_threshold:
    print('THRESHOLD_EXCEEDED')
    # print JSON summary to ease consumption
    out = {'threshold_exceeded': True, 'run_failures': run_failures, 'run_total': run_total, 'iter_failures': iter_failures, 'iter_total': iter_total, 'iter_rate': iter_rate}
    print(json.dumps(out))
    sys.exit(2)

print('OK')
sys.exit(0)
