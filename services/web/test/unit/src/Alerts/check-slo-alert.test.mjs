import { describe, it, expect } from 'vitest'
import { checkBenchOutput, formatAlert } from '../../../../../../ci/alerts/slo-alert'

describe('SLO Alert checker', function () {
  it('detects breach and formats alert message', function () {
    const data = { p50: 10, p95: 120, p99: 200 }
    const res = checkBenchOutput(data, 100)
    expect(res.breach).toBe(true)
    expect(res.p95).toBe(120)
    const msg = formatAlert({ name: 'introspection', ...res })
    expect(msg).toContain('ALERT')
    expect(msg).toContain('p95=120')
  })

  it('reports ok when p95 under threshold', function () {
    const data = { p50: 10, p95: 80, p99: 200 }
    const res = checkBenchOutput(data, 100)
    expect(res.breach).toBe(false)
    const msg = formatAlert({ name: 'key-lookup', ...res })
    expect(msg).toContain('OK')
  })
})