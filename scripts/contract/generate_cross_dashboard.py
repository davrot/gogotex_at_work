#!/usr/bin/env python3
"""
Generate an HTML trend dashboard for cross-instance parity runs.
Reads `ci/flakiness/collected/*_cross.json` and writes `ci/flakiness/cross/dashboard.html`.
"""
import json
import sys
from pathlib import Path
from datetime import datetime

OUT_DIR = Path('ci/flakiness/cross')
COLLECTED = Path('ci/flakiness/collected')
OUT_DIR.mkdir(parents=True, exist_ok=True)

files = sorted(COLLECTED.glob('*_cross.json'))
labels = []
success_rates = []
failures = []

for f in files:
    try:
        data = json.load(f.open())
    except Exception:
        continue
    total = len(data)
    success = sum(1 for it in data if it.get('success') == True)
    fail = total - success
    # derive a label: prefer timestamped local names, else use mtime
    name = f.name
    if 'run_local_' in name:
        # try to extract timestamp
        parts = name.split('_')
        # sample name: run_local_20251223T094138Z_cross.json
        for p in parts:
            if p.endswith('Z') and p.startswith('20'):
                try:
                    ts = datetime.strptime(p, '%Y%m%dT%H%M%SZ')
                    label = ts.isoformat()
                except Exception:
                    label = name
                break
        else:
            label = name
    elif name.startswith('run_') and name.endswith('_cross.json'):
        label = name[len('run_'):-len('_cross.json')]
    else:
        label = name
    labels.append(label)
    success_rates.append(0.0 if total == 0 else (success / total) * 100.0)
    failures.append(fail)

# fallback: if no collected files, try reading aggregate_cross.json
if not files:
    aggfile = Path('ci/flakiness/cross/aggregate_cross.json')
    if aggfile.exists():
        try:
            agg = json.load(aggfile.open())
            # flatten runs and create indices
            for i, run in enumerate(agg, start=1):
                total = len(run)
                success = sum(1 for it in run if it.get('success') == True)
                labels.append(f'run_{i}')
                success_rates.append(0.0 if total == 0 else (success / total) * 100.0)
                failures.append(total - success)
        except Exception:
            pass

# write an intermediate JSON for debugging/trends
OUT_DIR.joinpath('trend.json').write_text(json.dumps({
    'labels': labels,
    'success_rates': success_rates,
    'failures': failures,
}, indent=2))

# generate HTML with Chart.js
# include thresholds if provided via env
import os
iter_rate_threshold = float(os.environ.get('CROSS_ITER_FAILURE_RATE_THRESHOLD', '0.05'))
run_fail_threshold = int(os.environ.get('CROSS_RUN_FAIL_THRESHOLD', '1'))

# prepare per-label styling: mark any run with failures > 0
fail_colors = ["rgba(200,50,50,0.9)" if f and f > 0 else "rgba(120,120,120,0.6)" for f in failures]

data_payload = {
    'labels': labels,
    'success_rates': success_rates,
    'failures': failures,
    'fail_colors': fail_colors,
    'iter_rate_threshold': iter_rate_threshold,
    'run_fail_threshold': run_fail_threshold,
}

data_json = json.dumps(data_payload)

# compute a success-rate threshold (100 * (1 - iter_threshold)) to render as a line
success_threshold_pct = 100.0 * (1.0 - iter_rate_threshold)

html = (
    '<!doctype html>\n'
    '<html>\n'
    '<head>\n'
    '  <meta charset="utf-8">\n'
    '  <title>Parity Cross-Instance Dashboard (Trend)</title>\n'
    '  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n'
    '  <style>body{{font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 20px;}}</style>\n'
    '</head>\n'
    '<body>\n'
    '  <h1>Parity Cross-Instance Trend</h1>\n'
    '  <p>Generated: ' + datetime.utcnow().isoformat() + 'Z</p>\n'
    '  <p>Thresholds: iter failure rate >= ' + str(iter_rate_threshold) + ' (shows as success >= ' + ('%.1f' % (success_threshold_pct)) + '%), run failures >= ' + str(run_fail_threshold) + '</p>\n'
    '  <div style="width: 100%; max-width: 900px">\n'
    '    <canvas id="successChart" height="120"></canvas>\n'
    '  </div>\n'
    '  <div style="height: 20px"></div>\n'
    '  <div style="width: 100%; max-width: 900px">\n'
    '    <canvas id="failChart" height="80"></canvas>\n'
    '  </div>\n'
    '  <script>\n'
    '    const data = ' + data_json + ';\n'
    '    const ctxS = document.getElementById("successChart").getContext("2d");\n'
    '    const thresholdLine = Array(data.labels.length).fill(' + str(success_threshold_pct) + ');\n'
    '    const successChart = new Chart(ctxS, {\n'
    '      type: "line",\n'
    '      data: {\n'
    '        labels: data.labels,\n'
    '        datasets: [{\n'
    '          label: "Success rate (%)",\n'
    '          data: data.success_rates,\n'
    '          borderColor: "rgba(20,150,70,0.9)",\n'
    '          backgroundColor: "rgba(20,150,70,0.2)",\n'
    '          fill: true,\n'
    '          tension: 0.2\n'
    '        }, {\n'
    '          label: "Threshold (success %)",\n'
    '          data: thresholdLine,\n'
    '          borderColor: "rgba(0,0,200,0.7)",\n'
    '          borderDash: [6,3],\n'
    '          pointRadius: 0,\n'
    '          fill: false\n'
    '        }]\n'
    '      },\n'
    '      options: {\n'
    '        scales: {\n'
    '          y: {suggestedMin: 0, suggestedMax: 100}\n'
    '        }\n'
    '      }\n'
    '    });\n'
    '    const ctxF = document.getElementById("failChart").getContext("2d");\n'
    '    const failChart = new Chart(ctxF, {\n'
    '      type: "bar",\n'
    '      data: {\n'
    '        labels: data.labels,\n'
    '        datasets: [{\n'
    '          label: "Failed iterations",\n'
    '          data: data.failures,\n'
    '          backgroundColor: data.fail_colors,\n'
    '          borderColor: data.fail_colors,\n'
    '          borderWidth: 1\n'
    '        }]\n'
    '      },\n'
    '      options: {scales: {y: {suggestedMin: 0}}}\n'
    '    });\n'
    '  </script>\n'
    '  <p>Artifacts: <a href="aggregate_cross.json">aggregate_cross.json</a> | <a href="trend.json">trend.json</a></p>\n'
    '</body>\n'
    '</html>\n'
)


OUT_DIR.joinpath('dashboard.html').write_text(html)
print('Wrote', OUT_DIR.joinpath('dashboard.html'))

# exit success
sys.exit(0)
