#!/usr/bin/env node
'use strict'

const fs = require('fs')

function usage() {
  console.error('Usage: node check-bench-slo.js <bench_output.json> <p95_threshold_ms>')
  process.exit(2)
}

if (process.argv.length < 3) usage()

const outFile = process.argv[2]
const threshold = Number(process.argv[3] || process.env.INTROSPECTION_P95_MS || process.env.BENCH_SLO_P95_MS || '100')

if (!fs.existsSync(outFile)) {
  console.error('Bench output not found', outFile)
  process.exit(2)
}

const content = fs.readFileSync(outFile, 'utf8')
let data
try { data = JSON.parse(content) } catch (e) { console.error('Failed to parse bench output', e.message); process.exit(2) }

const p95 = Number(data.p95)
if (!Number.isFinite(p95)) {
  console.error('Bench output missing p95', data)
  process.exit(2)
}

console.log('Bench p95:', p95, 'ms; threshold:', threshold)
if (p95 > threshold) {
  console.error('SLO breached: p95 >', threshold)
  process.exit(1)
}

console.log('SLO passed (p95 <=', threshold, ')')
process.exit(0)
