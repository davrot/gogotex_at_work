#!/usr/bin/env node
/*
 * Key lookup benchmark harness
 * Usage: BENCH_URL=http://localhost:3000/internal/api/ssh-keys/SHA256:... BENCH_ITER=200 BENCH_OUTPUT=out.json node bench.js
 */
const http = require('http')
const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const TARGET = process.env.BENCH_URL || 'http://localhost:3000/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ITER = parseInt(process.env.BENCH_ITER || '200', 10)
const CONCURRENCY = parseInt(process.env.BENCH_CONCURRENCY || '20', 10)
const OUT = process.env.BENCH_OUTPUT || null

function now() { return Date.now() }

function requestOnce(client, options) {
  return new Promise((resolve, reject) => {
    const start = now()
    const req = client.request(options, (res) => {
      res.on('data', () => {})
      res.on('end', () => resolve(Date.now() - start))
    })
    req.on('error', (err) => reject(err))
    req.end()
  })
}

async function runRequests() {
  const url = new URL(TARGET)
  const client = url.protocol === 'https:' ? https : http
  const options = { method: 'GET', hostname: url.hostname, port: url.port, path: url.pathname + url.search }
  let inFlight = 0
  let completed = 0
  const latencies = []
  const errors = []

  return new Promise((resolve) => {
    function kick() {
      while (inFlight < CONCURRENCY && completed + inFlight < ITER) {
        inFlight++
        requestOnce(client, options).then((lat) => {
          latencies.push(lat)
          inFlight--
          completed++
          if (completed === ITER) resolve({ latencies, errors })
          else kick()
        }).catch((err) => {
          errors.push(err.message || String(err))
          inFlight--
          completed++
          if (completed === ITER) resolve({ latencies, errors })
          else kick()
        })
      }
    }
    kick()
  })
}

function quantile(sorted, q) { if (sorted.length === 0) return null; const idx = Math.floor(q * (sorted.length - 1)); return sorted[idx] }

(async function main() {
  console.log('Starting key lookup bench', { TARGET, ITER, CONCURRENCY })
  const result = await runRequests()
  const sorted = result.latencies.slice().sort((a, b) => a - b)
  const p50 = quantile(sorted, 0.5)
  const p95 = quantile(sorted, 0.95)
  const p99 = quantile(sorted, 0.99)
  const out = { p50, p95, p99, samples: result.latencies.length, errors: result.errors.length }
  if (OUT) {
    try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out)) ; console.log('WROTE_BENCH_OUTPUT=' + OUT) } catch (e) { console.error('Failed writing bench output', e) }
  } else {
    console.log(JSON.stringify(out))
  }
  process.exit(out.errors > 0 ? 2 : 0)
})()
