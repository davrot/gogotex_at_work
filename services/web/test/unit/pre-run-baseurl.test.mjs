import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';

describe('pre-run BASE_URL host blocking', function () {
  it('should fail when BASE_URL contains localhost', function () {
    const res = spawnSync(process.execPath, ['test/e2e/playwright/pre-run.js'], {
      cwd: process.cwd(),
      env: { ...process.env, BASE_URL: 'http://127.0.0.1:13000' },
      encoding: 'utf8',
    });
    // Expect non-zero exit and an error message about forbidden host
    assert.notEqual(res.status, 0, 'pre-run should exit with non-zero for localhost host');
    const stderr = (res.stdout || '') + (res.stderr || '');
    assert.ok(/forbidden host|must not be localhost|127\.0\.0\.1/.test(stderr), `unexpected output: ${stderr}`);
  });

  it('should accept a proper dev host', function () {
    const res = spawnSync(process.execPath, ['test/e2e/playwright/pre-run.js'], {
      cwd: process.cwd(),
      env: { ...process.env, BASE_URL: 'http://develop-webpack-1:3808', CONFIRM_DEV_SETUP: 'true' },
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `pre-run should exit 0 for recommended host; got status ${res.status} stdout=${res.stdout} stderr=${res.stderr}`);
  });
});
