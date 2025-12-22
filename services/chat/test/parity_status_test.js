import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import * as messagesController from '../app/js/Features/Messages/MessageHttpController.js'

const GO_PORT = 3011

function spawnGoServer(timeoutSeconds = 30) {
  const env = { ...process.env, PORT: String(GO_PORT) }
  // Use GO_RUN_TIMEOUT env var (e.g. '30s') if provided, otherwise use default seconds
  const timeout = process.env.GO_RUN_TIMEOUT || `${timeoutSeconds}s`
  // Use bash -lc with timeout to ensure the process won't hang indefinitely
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
  console.log('Calling Node controller getStatus directly...')

  const context = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body } }, requestBody: {}, params: {} }
  const nodeBody = await messagesController.getStatus(context)

  console.log('Checking for existing Go server...')
  let goProc = null
  let reused = false
  try {
    await waitFor(`http://127.0.0.1:${GO_PORT}/status`, 500)
    reused = true
    console.log('Reusing existing Go server')
  } catch (_) {
    console.log('Starting Go server...')
    goProc = spawnGoServer()
  }

  try {
    await waitFor(`http://127.0.0.1:${GO_PORT}/status`, 5000)

    const goRes = await fetch(`http://127.0.0.1:${GO_PORT}/status`)
    let goBody = await goRes.text()
    try {
      const parsed = JSON.parse(goBody)
      if (typeof parsed === 'string') goBody = parsed
    } catch (e) {
      // not JSON, leave as-is
    }

    console.log('Node /status (controller) =>', nodeBody)
    console.log('Go   /status =>', goBody)

    if (nodeBody !== goBody) {
      throw new Error('Parity check failed: responses differ')
    }

    console.log('Parity check passed')
  } finally {
    if (goProc && !reused) {
      goProc.kill()
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
main().catch(err => {
  console.error(err)
  process.exit(1)
})
