#!/usr/bin/env python3
"""
Generate a simple SVG status badge from ci/flakiness/cross/status.json or summary.json.
Writes: ci/flakiness/cross/status.svg
Badge: green when threshold_exceeded == false, red when true, gray when no data.
"""
import json
import os
import argparse
from pathlib import Path

parser = argparse.ArgumentParser(description='Generate a status badge SVG from cross-instance summary.')
parser.add_argument('--status', default='ci/flakiness/cross/status.json', help='Path to status.json')
parser.add_argument('--summary', default='ci/flakiness/cross/summary.json', help='Path to summary.json fallback')
parser.add_argument('--out', default='ci/flakiness/cross/status.svg', help='Output SVG path')
parser.add_argument('--label', default='parity', help='Left label for badge')
parser.add_argument('--ok-text', default='ok', help='Text when OK')
parser.add_argument('--alert-text', default='alert', help='Text when alert')
parser.add_argument('--unknown-text', default='unknown', help='Text when unknown')
parser.add_argument('--ok-color', default='#4c1', help='Color when OK')
parser.add_argument('--alert-color', default='#e05d44', help='Color when alert')
parser.add_argument('--unknown-color', default='#555', help='Color when unknown')
parser.add_argument('--width', type=int, default=120, help='SVG width')
parser.add_argument('--height', type=int, default=20, help='SVG height')
args = parser.parse_args()

OUT = Path(args.out)
OUT.parent.mkdir(parents=True, exist_ok=True)

status = None
if Path(args.status).exists():
    try:
        status = json.loads(Path(args.status).read_text())
    except Exception:
        status = None
elif Path(args.summary).exists():
    try:
        s = json.loads(Path(args.summary).read_text())
        status = {'summary': s}
    except Exception:
        status = None

# Determine threshold_exceeded either from status object or by computing using thresholds
threshold_exceeded = False
if status and isinstance(status, dict):
    # if checker previously set 'threshold_exceeded', respect it
    if 'threshold_exceeded' in status:
        threshold_exceeded = bool(status.get('threshold_exceeded', False))
    else:
        s = status.get('summary', {})
        run_failures = int(s.get('run_failures', 0))
        iter_failures = int(s.get('iter_failures', 0))
        iter_total = int(s.get('iter_total', 0))
        iter_rate = float(s.get('iter_failure_rate', 0.0)) if s.get('iter_failure_rate') is not None else (0.0 if iter_total == 0 else (iter_failures / iter_total))
        # thresholds from environment
        run_threshold = int(os.environ.get('CROSS_RUN_FAIL_THRESHOLD', '1') or '1')
        iter_rate_threshold = float(os.environ.get('CROSS_ITER_FAILURE_RATE_THRESHOLD', '0.05') or '0.05')
        threshold_exceeded = (run_failures >= run_threshold) or (iter_rate >= iter_rate_threshold)

# Render badge
if status is None:
    color = args.unknown_color
    text = f"{args.label}: {args.unknown_text}"
else:
    if threshold_exceeded:
        color = args.alert_color
        text = f"{args.label}: {args.alert_text}"
    else:
        color = args.ok_color
        text = f"{args.label}: {args.ok_text}"

svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{args.width}" height="{args.height}"><rect width="{args.width}" height="{args.height}" fill="{color}"/><text x="{args.width//2}" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">{text}</text></svg>'
OUT.write_text(svg)
print('Wrote status badge at', OUT)
