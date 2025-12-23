#!/usr/bin/env python3
import json
import os
from pathlib import Path
import subprocess

def write_summary(run_total=3, run_failures=1, iter_total=30, iter_failures=2):
    d = {'run_total': run_total, 'run_failures': run_failures, 'iter_total': iter_total, 'iter_failures': iter_failures}
    Path('ci/flakiness/cross').mkdir(parents=True, exist_ok=True)
    Path('ci/flakiness/cross/summary.json').write_text(json.dumps(d))


def run_check(env=None):
    cmd = ['python3', 'scripts/contract/check_cross_thresholds.py']
    res = subprocess.run(cmd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    return res


def test_default_threshold_trigger():
    write_summary(run_total=3, run_failures=1, iter_total=30, iter_failures=0)
    r = run_check()
    assert r.returncode == 2


def test_iter_rate_threshold_trigger():
    write_summary(run_total=5, run_failures=0, iter_total=100, iter_failures=10)
    r = run_check(env={'CROSS_ITER_FAILURE_RATE_THRESHOLD': '0.05'})
    # 10/100 = 0.10 >= 0.05 => trigger
    assert r.returncode == 2


def test_no_trigger():
    write_summary(run_total=5, run_failures=0, iter_total=100, iter_failures=1)
    r = run_check(env={'CROSS_ITER_FAILURE_RATE_THRESHOLD': '0.05'})
    assert r.returncode == 0


if __name__ == '__main__':
    failed = False
    for fn in [test_default_threshold_trigger, test_iter_rate_threshold_trigger, test_no_trigger]:
        try:
            fn()
            print(fn.__name__, 'OK')
        except AssertionError:
            print(fn.__name__, 'FAILED')
            failed = True
    if failed:
        raise SystemExit(1)
    print('ALL TESTS PASSED')
