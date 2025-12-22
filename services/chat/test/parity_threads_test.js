import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import * as messagesController from '../app/js/Features/Messages/MessageHttpController.js'
import * as ThreadManager from '../app/js/Features/Threads/ThreadManager.js'
import * as MessageManager from '../app/js/Features/Messages/MessageManager.js'

let GO_PORT = 3011

async function getFreePort() {
  const net = await import('node:net')
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

function spawnGoServer(port, timeoutSeconds = 30) {
  const env = { ...process.env, PORT: String(port) }
  const timeout = process.env.GO_RUN_TIMEOUT || `${timeoutSeconds}s`
  const cmd = `timeout ${timeout} go run ./cmd/chat`
  const p = spawn('bash', ['-lc', cmd], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.on('data', d => process.stdout.write(`[go] ${d}`))
  p.stderr.on('data', d => process.stderr.write(`[go] ${d}`))
  return p
}

function spawnGoServerWithSeed(port, seed, timeoutSeconds = 30) {
  const env = { ...process.env, PORT: String(port), SEED_THREADS: JSON.stringify(seed) }
  const timeout = process.env.GO_RUN_TIMEOUT || `${timeoutSeconds}s`
  const cmd = `timeout ${timeout} go run ./cmd/chat`
  const p = spawn('bash', ['-lc', cmd], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.on('data', d => process.stdout.write(`[go] ${d}`))
  p.stderr.on('data', d => process.stderr.write(`[go] ${d}`))
  return p
}

async function waitFor(url, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
    } catch (err) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`timeout waiting for ${url}`)
}

async function main() {
  // Seed Node server via env to return deterministic response without DB
  const projectId = '507f1f77bcf86cd799439011'
  process.env.SEED_THREADS = JSON.stringify({ [projectId]: ['t1', 't2'] })

  const context = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body }, json(obj) { this.body = obj } }, requestBody: {}, params: { path: { projectId } } }
  await messagesController.getThreads(context)
  const nodeBody = context.res.body

  let goProc = null
  let reused = false
  try {
    // If a Go server is already running, reuse it; otherwise spawn a seeded instance
    // Reserve a free port for this test run
    GO_PORT = await getFreePort()

    try {
      await waitFor(`http://127.0.0.1:${GO_PORT}/project/abc/threads`, 500)
      reused = true
      console.log('Reusing existing Go server')
    } catch (_) {
      console.log('Starting seeded Go server')
      goProc = spawnGoServerWithSeed(GO_PORT, { abc: ['t1', 't2'] })
    }

    await waitFor(`http://127.0.0.1:${GO_PORT}/project/abc/threads`, 5000)

    const goRes = await fetch(`http://127.0.0.1:${GO_PORT}/project/abc/threads`)
    const goBody = await goRes.json()

    console.log('Node getThreads (controller) =>', nodeBody)
    console.log('Go   /project/abc/threads =>', goBody)

    if (JSON.stringify(nodeBody) !== JSON.stringify(goBody)) {
      throw new Error('Parity check failed: responses differ')
    }

    console.log('Parity check passed')
  } finally {
    // Cleanup: ensure we remove the seed env var and stop the Go process we started
    delete process.env.SEED_THREADS
    if (goProc && !reused) {
      try {
        goProc.kill()
        await new Promise((resolve) => {
          goProc.once('close', resolve)
        })
      } catch (e) {
        // ignore
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})