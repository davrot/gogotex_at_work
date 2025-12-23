#!/usr/bin/env python3
"""Generate Slack message payload given flakiness and cross summaries."""
import json
import sys
from pathlib import Path

def format_message(report_text, cross_summary_text=None, cross_alert=False, failures=0, repo='repo'):
    title = ':warning: Parity flakiness weekly summary: failures=%d' % failures
    if cross_alert:
        title = ':rotating_light: Parity cross-instance threshold exceeded'
    text = f"{title}\n\nRepository: {repo}\nDate: {__import__('datetime').datetime.utcnow().isoformat()[:10]}"
    if cross_summary_text:
        text += '\n\n' + cross_summary_text
    text += '\n\nAttached artifacts: parity-flakiness-aggregate (aggregate.json) and parity-cross-dashboard (dashboard).'
    return {'text': text}

if __name__ == '__main__':
    # simple CLI: report file, cross report file, cross_alert flag
    report = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 and Path(sys.argv[1]).exists() else ''
    cross = Path(sys.argv[2]).read_text() if len(sys.argv) > 2 and Path(sys.argv[2]).exists() else ''
    cross_alert = (sys.argv[3] == '1') if len(sys.argv) > 3 else False
    repo = sys.argv[4] if len(sys.argv) > 4 else 'repo'
    print(json.dumps(format_message(report, cross, cross_alert, repo=repo)))
