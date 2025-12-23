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
data_json = json.dumps({'labels': labels, 'success_rates': success_rates, 'failures': failures})
html = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Parity Cross-Instance Dashboard (Trend)</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>body{{font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 20px;}}</style>
</head>
<body>
  <h1>Parity Cross-Instance Trend</h1>
  <p>Generated: {generated_at}Z</p>
  <div style="width: 100%; max-width: 900px">
    <canvas id="successChart" height="120"></canvas>
  </div>
  <div style="height: 20px"></div>
  <div style="width: 100%; max-width: 900px">
    <canvas id="failChart" height="80"></canvas>
  </div>
  <script>
    const data = {data_json};
    const ctxS = document.getElementById('successChart').getContext('2d');
    const successChart = new Chart(ctxS, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Success rate (%)',
          data: data.success_rates,
          borderColor: 'rgba(20,150,70,0.9)',
          backgroundColor: 'rgba(20,150,70,0.2)',
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        scales: {
          y: {suggestedMin: 0, suggestedMax: 100}
        }
      }
    });
    const ctxF = document.getElementById('failChart').getContext('2d');
    const failChart = new Chart(ctxF, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Failed iterations',
          data: data.failures,
          backgroundColor: 'rgba(200,50,50,0.9)'
        }]
      },
      options: {scales: {y: {suggestedMin: 0}}}
    });
  </script>
  <p>Artifacts: <a href="aggregate_cross.json">aggregate_cross.json</a> | <a href="trend.json">trend.json</a></p>
</body>
</html>
""".format(generated_at=datetime.utcnow().isoformat(), data_json=data_json)

OUT_DIR.joinpath('dashboard.html').write_text(html)
print('Wrote', OUT_DIR.joinpath('dashboard.html'))

# exit success
sys.exit(0)
