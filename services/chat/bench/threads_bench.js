import fetch from 'node-fetch'

const URL = process.env.BENCH_URL || 'http://127.0.0.1:3011/project/abc/threads'
const ITER = parseInt(process.env.BENCH_ITER || '100', 10)

async function main() {
  const times = []
  for (let i = 0; i < ITER; i++) {
    const start = Date.now()
    const res = await fetch(URL)
    await res.text()
    times.push(Date.now() - start)
  }
  times.sort((a, b) => a - b)
  const p50 = times[Math.floor(ITER * 0.5)]
  const p95 = times[Math.floor(ITER * 0.95)]
  console.log(JSON.stringify({ p50, p95, iter: ITER }))
}

main().catch(err => { console.error(err); process.exit(1) })