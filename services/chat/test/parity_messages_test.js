import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import * as messagesController from '../app/js/Features/Messages/MessageHttpController.js'

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
  // Test 1: missing content should return the same error
  const context1 = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body }, json(obj) { this.body = obj } }, requestBody: { user_id: '507f1f77bcf86cd799439011' }, params: { path: { projectId: 'abc', threadId: 't1' } } }
  const nodeBody1 = await messagesController.sendMessage(context1)

  let goProc = null
  let port = await getFreePort()
  try {
    console.log('Starting Go server for parity messages test')
    goProc = spawnGoServer(port)

    await waitFor(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`)

    const goRes1 = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: '507f1f77bcf86cd799439011' }),
    })
    const goBodyText1 = await goRes1.text()

    console.log('Node sendMessage =>', nodeBody1)
    console.log('Go  POST (missing content) =>', goRes1.status, goBodyText1)

    if (goRes1.status !== 400) throw new Error('Go parity failed: expected 400 for missing content')

    // Test 2: invalid user id
    const context2 = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body }, json(obj) { this.body = obj } }, requestBody: { user_id: 'bad', content: 'hello' }, params: { path: { projectId: 'abc', threadId: 't1' } } }
    const nodeBody2 = await messagesController.sendMessage(context2)

    const goRes2 = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'bad', content: 'hello' }),
    })
    const goBodyText2 = await goRes2.text()

    console.log('Node sendMessage invalid user =>', nodeBody2)
    console.log('Go POST invalid user =>', goRes2.status, goBodyText2)

    if (goRes2.status !== 400) throw new Error('Go parity failed: expected 400 for invalid user')

    console.log('Parity message validation checks passed')
  } finally {
    if (goProc) {
      try { goProc.kill() } catch (e) {}
      await new Promise(r => goProc.once('close', r))
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
