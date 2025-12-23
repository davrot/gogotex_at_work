#!/usr/bin/env python3
import json
from pathlib import Path
import shutil

# Prepare sample collected files
col = Path('ci/flakiness/collected')
col.mkdir(parents=True, exist_ok=True)
for i in range(3):
    sample = [{'iteration': j+1, 'success': (j % 3) != 0} for j in range(5)]
    Path(col / f'run_local_20251223T10000{i}Z_cross.json').write_text(json.dumps(sample))

# Run generator
Path('ci/flakiness/cross').mkdir(parents=True, exist_ok=True)
ret = None
try:
    import subprocess
    ret = subprocess.run(['python3', 'scripts/contract/generate_cross_dashboard.py'], check=True)
except Exception as e:
    print('Generator failed:', e)
    raise

# Validate outputs
assert (Path('ci/flakiness/cross/trend.json')).exists()
assert (Path('ci/flakiness/cross/dashboard.html')).exists()
print('Generator outputs exist: OK')

# quick JSON sanity
d = json.loads(Path('ci/flakiness/cross/trend.json').read_text())
assert 'labels' in d and 'success_rates' in d and 'failures' in d
print('trend.json sanity: OK')

# cleanup samples
shutil.rmtree(col)
print('ALL OK')

if __name__ == '__main__':
    pass
