#!/usr/bin/env node
// Simple benchmark harness: POST N messages and report request latencies
const http = require('http')
const url = require('url')

const TARGET = process.env.TARGET || 'http://127.0.0.1:3011'
const ITER = parseInt(process.env.ITER || '50', 10)

function postMessage(path, body) {
  return new Promise((resolve, reject) => {
    const u = url.parse(path)
    const data = JSON.stringify(body)
    const opts = { method: 'POST', hostname: u.hostname, port: u.port, path: u.path, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }
    const req = http.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  const latencies = []
  for (let i = 0; i < ITER; i++) {
    const start = Date.now()
    await postMessage(`${TARGET}/project/abc/threads/t1/messages`, { user_id: '507f1f77bcf86cd799439011', content: `hello ${i}` })
    latencies.push(Date.now() - start)
  }
  latencies.sort((a,b)=>a-b)
  const p50 = latencies[Math.floor(latencies.length*0.5)]
  const p95 = latencies[Math.floor(latencies.length*0.95)]
  const p99 = latencies[Math.floor(latencies.length*0.99)]
  console.log(`p50=${p50}ms p95=${p95}ms p99=${p99}ms`)
}

main().catch(e=>{ console.error(e); process.exit(2) })
