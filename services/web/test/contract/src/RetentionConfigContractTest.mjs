import assert from 'assert'

describe('Retention Config Contract', function () {
  it('ensures AUDIT_LOG_RETENTION_DAYS is set in CI and >= 90', function () {
    if (!process.env.CI) {
      // Not running in CI, skip test (contract asserts run in CI)
      this.skip()
    }
    const val = process.env.AUDIT_LOG_RETENTION_DAYS || process.env.AUDIT_LOG_RETENTION_DAYS
    assert.ok(val, 'AUDIT_LOG_RETENTION_DAYS must be set in CI environment')
    assert.ok(/^[0-9]+$/.test(val), 'AUDIT_LOG_RETENTION_DAYS must be integer')
    assert.ok(parseInt(val, 10) >= 90, 'AUDIT_LOG_RETENTION_DAYS must be >= 90')
  })
})