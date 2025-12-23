import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import * as messagesController from '../app/js/Features/Messages/MessageHttpController.js'

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
  const port = await getFreePort()
  const goProc = spawnGoServer(port)
  try {
    await waitFor(`http://127.0.0.1:${port}/status`, 5000)

    // POST a message
    const post = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: '507f1f77bcf86cd799439011', content: 'hello-parity' })
    })
    const postBody = await post.json()
    if (post.status !== 201) throw new Error('POST failed')

    // Edit message m1
    const edit = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages/m1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'edited-parity' })
    })
    if (edit.status !== 204) throw new Error('Edit failed')

    const getRes = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`)
    const getBody = await getRes.json()
    const found = getBody.find(m => m.content === 'edited-parity')
    if (!found) throw new Error('Edited message not found')

    // Delete it
    const del = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages/m1`, { method: 'DELETE' })
    if (del.status !== 204) throw new Error('Delete failed')

    const getRes2 = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`)
    const getBody2 = await getRes2.json()
    if (Array.isArray(getBody2) && getBody2.length !== 0) throw new Error('Expected empty after delete')

    console.log('Parity edit/delete roundtrip passed')
  } finally {
    try { goProc.kill() } catch (e) {}
    await new Promise(r => goProc.once('close', r))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
