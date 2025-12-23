#!/usr/bin/env python3
"""
Generate a simple SVG status badge from ci/flakiness/cross/status.json or summary.json.
Writes: ci/flakiness/cross/status.svg
Badge: green when threshold_exceeded == false, red when true, gray when no data.
"""
import json
from pathlib import Path

OUT = Path('ci/flakiness/cross')
OUT.mkdir(parents=True, exist_ok=True)
status = None
if Path('ci/flakiness/cross/status.json').exists():
    try:
        status = json.loads(Path('ci/flakiness/cross/status.json').read_text())
    except Exception:
        status = None
elif Path('ci/flakiness/cross/summary.json').exists():
    s = json.loads(Path('ci/flakiness/cross/summary.json').read_text())
    status = {'summary': s, 'threshold_exceeded': (s.get('run_failures',0) > 0 or s.get('iter_failure_rate',0) > 0)}

if not status:
    # write a gray unknown badge
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"><rect width="120" height="20" fill="#555"/><text x="60" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">parity: unknown</text></svg>'
    OUT.joinpath('status.svg').write_text(svg)
    print('Wrote unknown badge')
    raise SystemExit(0)

ex = status.get('threshold_exceeded', False)
if ex:
    color = '#e05d44'  # red
    text = 'parity: alert'
else:
    color = '#4c1'  # green
    text = 'parity: ok'

svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"><rect width="120" height="20" fill="{color}"/><text x="60" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">{text}</text></svg>'
OUT.joinpath('status.svg').write_text(svg)
print('Wrote status badge at', OUT.joinpath('status.svg'))
