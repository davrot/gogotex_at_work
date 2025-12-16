import { spawnSync } from 'node:child_process'
import { strict as assert } from 'node:assert'

describe('git acceptance scripts host blocking', function () {
  it('git-https-acceptance should reject localhost host', function () {
    const res = spawnSync('bash', ['scripts/e2e/git-https-acceptance.sh', 'proj1', '127.0.0.1', '80'], { encoding: 'utf8' })
    assert.notEqual(res.status, 0)
    const out = (res.stdout || '') + (res.stderr || '')
    assert.ok(/must not be localhost|127\.0\.0\.1/.test(out), `unexpected output: ${out}`)
  })

  it('git-ssh-acceptance should reject localhost host', function () {
    const res = spawnSync('bash', ['scripts/e2e/git-ssh-acceptance.sh', 'user123', '127.0.0.1', '22'], { encoding: 'utf8' })
    assert.notEqual(res.status, 0)
    const out = (res.stdout || '') + (res.stderr || '')
    assert.ok(/must not be localhost|127\.0\.0\.1/.test(out), `unexpected output: ${out}`)
  })
})
