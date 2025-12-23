import fetch from 'node-fetch'

async function waitFor(port, timeoutMs = 15000) {
  const url = `http://127.0.0.1:${port}/status`
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch (e) { }
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

async function main() {
  const portA = process.env.PORT_A || 3011
  const portB = process.env.PORT_B || 3012

  console.log(`Waiting for instances on ${portA} and ${portB}...`)
  if (!(await waitFor(portA))) {
    console.error(`Instance on port ${portA} did not become ready`)
    process.exit(2)
  }
  if (!(await waitFor(portB))) {
    console.error(`Instance on port ${portB} did not become ready`)
    process.exit(2)
  }

  const unique = `multi-${Date.now()}`
  console.log('Posting message to instance A:', portA)
  const post = await fetch(`http://127.0.0.1:${portA}/project/dbtest/threads/t1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: '507f1f77bcf86cd799439011', content: unique })
  })
  const postBody = await post.json().catch(() => null)
  if (post.status !== 201) {
    console.error('POST failed', post.status, postBody)
    process.exit(2)
  }

  // wait briefly for persistence/propagation
  await new Promise(r => setTimeout(r, 500))

  console.log('Querying instance B for messages:', portB)
  const res = await fetch(`http://127.0.0.1:${portB}/project/dbtest/threads/t1/messages`)
  const resBody = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('GET failed', res.status, resBody)
    process.exit(2)
  }

  const msgs = Array.isArray(resBody) ? resBody : (resBody?.messages || resBody?.data || [])
  const found = msgs.find(m => m.content === unique || (m && m.content === unique))
  if (!found) {
    console.error('Message not visible from other instance', JSON.stringify(msgs, null, 2))
    process.exit(2)
  }

  console.log('Multi-instance persistence verified')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
