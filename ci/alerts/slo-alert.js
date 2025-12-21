'use strict'

module.exports.checkBenchOutput = function (data, thresholdMs) {
  const p95 = Number(data.p95)
  if (!Number.isFinite(p95)) throw new Error('bench output missing p95')
  return {
    breach: p95 > thresholdMs,
    p95,
    thresholdMs,
  }
}

module.exports.formatAlert = function ({ name, breach, p95, thresholdMs }) {
  if (breach) {
    return `${name} ALERT: p95=${p95}ms > threshold=${thresholdMs}ms`
  }
  return `${name} OK: p95=${p95}ms <= threshold=${thresholdMs}ms`
}
