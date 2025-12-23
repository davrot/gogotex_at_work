import { spawn } from 'child_process'
const fetch = global.fetch || (await import('node-fetch')).default

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
    const postRes = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: '507f1f77bcf86cd799439011', content: 'hello-roundtrip' })
    })
    const postBody = await postRes.json()
    if (postRes.status !== 201) {
      console.error('Expected 201, got', postRes.status, postBody)
      throw new Error('POST failed')
    }
    console.log('POST body:', postBody)

    // GET messages
    const getRes = await fetch(`http://127.0.0.1:${port}/project/abc/threads/t1/messages`)
    const getBody = await getRes.json()

    console.log('GET body:', getBody)
    if (!Array.isArray(getBody) || getBody.length === 0) {
      throw new Error('Expected non-empty messages array')
    }
    const found = getBody.find(m => m.content === 'hello-roundtrip')
    if (!found) throw new Error('Posted message not found in GET response')

    console.log('Roundtrip parity check passed')
  } finally {
    try { goProc.kill() } catch (_) {}
    await new Promise(r => goProc.once('close', r))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
