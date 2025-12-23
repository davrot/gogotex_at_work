#!/usr/bin/env python3
import json
import subprocess

def test_basic():
    # run format_slack_message.py and parse JSON output
    res = subprocess.run(['python3', 'scripts/contract/format_slack_message.py', 'ci/flakiness/report.txt', 'ci/flakiness/cross/report.txt', '1', 'owner/repo'], capture_output=True, text=True)
    out = json.loads(res.stdout)
    assert 'owner/repo' in out['text']

if __name__ == '__main__':
    test_basic()
    print('format_slack_message OK')
