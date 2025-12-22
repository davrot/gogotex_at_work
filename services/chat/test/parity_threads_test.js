import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import * as messagesController from '../app/js/Features/Messages/MessageHttpController.js'
import * as ThreadManager from '../app/js/Features/Threads/ThreadManager.js'
import * as MessageManager from '../app/js/Features/Messages/MessageManager.js'

const GO_PORT = 3011

function spawnGoServer() {
  const env = { ...process.env, PORT: String(GO_PORT) }
  const p = spawn('go', ['run', './cmd/chat'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
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
  // stub ThreadManager and MessageManager to return a deterministic response
  const originalFindAll = ThreadManager.findAllThreadRooms
  const originalGetMessages = MessageManager.getMessages
  ThreadManager.findAllThreadRooms = async (projectId) => [{ _id: 'room1', thread_id: 't1' }]
  MessageManager.getMessages = async (roomId, limit, before) => []

  const context = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body }, json(obj) { this.body = obj } }, requestBody: {}, params: { path: { projectId: 'abc' } } }
  const nodeBody = await messagesController.getThreads(context)

  let goProc = null
  let reused = false
  try {
    try {
      await waitFor(`http://127.0.0.1:${GO_PORT}/project/abc/threads`, 500)
      reused = true
    } catch (_) {
      goProc = spawnGoServer()
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
    ThreadManager.findAllThreadRooms = originalFindAll
    MessageManager.getMessages = originalGetMessages
    if (goProc && !reused) {
      goProc.kill()
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})