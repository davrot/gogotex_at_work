import { spawn } from 'child_process'
import fetch from 'node-fetch'
import { MongoClient } from 'mongodb'

async function main() {
  const mongoUrl = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat_test'
  if (!mongoUrl) {
    console.log('Skipping contract test: MONGO_URI not provided')
    process.exit(0)
  }

  console.log('Connecting to Mongo at', mongoUrl)
  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db()
  await db.collection('messages').deleteMany({})

  // Start Go server
  const port = process.env.GO_PORT || 3011
  const goCmd = `PORT=${port} timeout ${process.env.GO_RUN_TIMEOUT || '120s'} go run ./cmd/chat`
  const goProc = spawn('bash', ['-lc', goCmd], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), MONGO_URI: mongoUrl } })
  goProc.stdout.on('data', d => process.stdout.write(`[go] ${d}`))
  goProc.stderr.on('data', d => process.stderr.write(`[go] ${d}`))

  // wait for ready
  const start = Date.now()
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`)
      if (res.ok) break
    } catch (e) { }
    await new Promise(r => setTimeout(r, 200))
  }

  // POST message via Node-like payload
  const post = await fetch(`http://127.0.0.1:${port}/project/dbtest/threads/t1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: '507f1f77bcf86cd799439011', content: 'contract-test' })
  })
  const postBody = await post.json()
  if (post.status !== 201) {
    console.error('POST failed', post.status, postBody)
    process.exit(2)
  }

  // Query Mongo directly and assert message persisted
  const msgs = await db.collection('messages').find({ room_id: 't1' }).toArray()
  if (!msgs || msgs.length === 0) {
    console.error('Message not found in Mongo')
    process.exit(2)
  }
  console.log('Message persisted to Mongo, contract test passed')

  // cleanup
  await db.collection('messages').deleteMany({})
  await client.close()
  try { goProc.kill() } catch (e) {}
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
