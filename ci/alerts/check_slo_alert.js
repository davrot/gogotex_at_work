#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const { checkBenchOutput, formatAlert } = require('./slo-alert')

function usage() {
  console.error('Usage: node check_slo_alert.js <bench_output.json> <threshold_ms> <alert_name>')
  process.exit(2)
}

if (process.argv.length < 4) usage()
const outFile = process.argv[2]
const threshold = Number(process.argv[3])
const name = process.argv[4] || path.basename(outFile)

if (!fs.existsSync(outFile)) {
  console.error('Bench output not found', outFile)
  process.exit(2)
}

const content = fs.readFileSync(outFile, 'utf8')
let data
try { data = JSON.parse(content) } catch (e) { console.error('Failed to parse bench output', e.message); process.exit(2) }

let res
try { res = checkBenchOutput(data, threshold) } catch (e) { console.error('Invalid bench output:', e.message); process.exit(2) }

console.log(formatAlert({ name, ...res }))
process.exit(res.breach ? 1 : 0)
