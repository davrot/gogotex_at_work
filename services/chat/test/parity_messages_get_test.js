import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default
import { MongoClient, ObjectId } from 'mongodb'

// Ensure Node's Settings pick up the MONGO connection we intend to use before loading controllers
const mongoUrl = process.env.MONGO_CONNECTION_STRING || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat_test'
// Set both env vars used across the codebase so Settings.mongo.url resolves to the same DB
process.env.MONGO_CONNECTION_STRING = mongoUrl
process.env.MONGO_URI = mongoUrl

const messagesController = await import('../app/js/Features/Messages/MessageHttpController.js')

// Parity test: seed Mongo, compare Node controller getThread() with Go /project/:id/threads/:id
async function main() {
  if (!mongoUrl) {
    console.log('Skipping parity messages GET test: MONGO_URI not provided')
    process.exit(0)
  }

  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db()

  const projectId = new ObjectId('507f1f77bcf86cd799439011')
  const threadId = new ObjectId()
  const userId = new ObjectId('507f1f77bcf86cd799439012')

  await db.collection('rooms').deleteMany({ project_id: projectId })
  await db.collection('messages').deleteMany({ room_id: { $exists: true } })

  const roomRes = await db.collection('rooms').insertOne({ project_id: projectId, thread_id: threadId })
  const roomId = roomRes.insertedId

  const now = Date.now()
  const msgs = [
    { content: 'parity-1', room_id: roomId, user_id: userId, timestamp: now - 2000 },
    { content: 'parity-2', room_id: roomId, user_id: userId, timestamp: now - 1000 },
    { content: 'parity-3', room_id: roomId, user_id: userId, timestamp: now },
  ]
  await db.collection('messages').insertMany(msgs)

  // Node controller response
  const context = { res: { statusCode: null, status(code) { this.statusCode = code; return this }, setBody(body) { this.body = body }, json(obj) { this.body = obj } }, requestBody: {}, params: { path: { projectId: projectId.toString(), threadId: threadId.toString() }, query: {} } }
  await messagesController.getThread(context)
  const nodeBody = context.res.body

  // Start Go server and point to same Mongo
  const port = await getFreePort()
  const goProc = spawnGoServerWithEnv(port, { MONGO_URI: mongoUrl })
  try {
    await waitFor(`http://127.0.0.1:${port}/project/${projectId.toString()}/threads/${threadId.toString()}`, 5000)

    const goRes = await fetch(`http://127.0.0.1:${port}/project/${projectId.toString()}/threads/${threadId.toString()}`)
    const goBody = await goRes.json()

    console.log('Node getThread (controller) =>', nodeBody)
    console.log('Go   /project/<id>/threads/<id> =>', goBody)

    // Normalize both responses to canonical JSON structures for comparison
    function normalize(body) {
      if (!body || !body.messages) return { messages: [] }
      const msgs = body.messages.map(m => {
        const id = m.id || m._id || (m._id && m._id.toString && m._id.toString()) || null
        const userId = m.user_id && typeof m.user_id === 'object' && m.user_id.toString ? m.user_id.toString() : String(m.user_id || '')
        return {
          id: id ? id.toString() : null,
          content: m.content,
          timestamp: Number(m.timestamp || 0),
          user_id: userId,
        }
      })
      // sort by timestamp for deterministic compare
      msgs.sort((a, b) => a.timestamp - b.timestamp)
      return { messages: msgs }
    }

    const normNode = normalize(nodeBody)
    const normGo = normalize(goBody)

    if (JSON.stringify(normNode) !== JSON.stringify(normGo)) {
      console.error('Normalized Node =>', JSON.stringify(normNode))
      console.error('Normalized Go   =>', JSON.stringify(normGo))
      throw new Error('Parity check failed: responses differ')
    }

    console.log('Parity GET messages check passed')
  } finally {
    // Attempt graceful shutdown, then force kill if still alive
    try { goProc.kill('SIGTERM') } catch (e) {}
    await new Promise(r => setTimeout(r, 500))
    try { process.kill(goProc.pid, 'SIGKILL') } catch (e) {}
    await db.collection('messages').deleteMany({ room_id: roomId })
    await db.collection('rooms').deleteOne({ _id: roomId })
    await client.close()
  }
}

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

function spawnGoServerWithEnv(port, extraEnv = {}, timeoutSeconds = 30) {
  const env = { ...process.env, PORT: String(port), ...extraEnv }
  const timeout = process.env.GO_RUN_TIMEOUT || `${timeoutSeconds}s`
  const cmd = `timeout ${timeout} bash -lc 'cd ../chat-go && exec go run .'`
  const p = spawn('bash', ['-lc', cmd], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.on('data', d => process.stdout.write(`[go] ${d}`))
  p.stderr.on('data', d => process.stderr.write(`[go] ${d}`))
  p.on('exit', (code, sig) => process.stdout.write(`[go] exited code=${code} sig=${sig}\n`))
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

main().catch(err => { console.error(err); process.exit(1) })
