(async () => {
  const fetch = (await import('node-fetch')).default
  const argv = process.argv.slice(2)
  const base1 = process.env.INSTANCE1 || argv[0] || 'http://webprofile-api-parity-node1:3900'
  const base2 = process.env.INSTANCE2 || argv[1] || 'http://webprofile-api-parity-node2:3900'
  const auth = 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64')
  const headers = { 'Authorization': auth, 'Content-Type': 'application/json' }

  const userId = 'cross-' + Date.now()

  console.log('create on', base1)
  const createResp = await fetch(base1 + '/internal/api/users/' + userId + '/git-tokens', { method: 'POST', headers, body: JSON.stringify({ label: 'cross', scopes: ['repo:read'] }) })
  console.log('create status', createResp.status)
  const createBody = await createResp.json()
  const token = createBody.token || createBody.plaintext
  const id = createBody.id && String(createBody.id)
  if (!token || !id) { console.error('missing token/id', createBody); process.exit(2) }

  console.log('revoke via', base2)
  const revoke = await fetch(base2 + `/internal/api/users/${userId}/git-tokens/${id}`, { method: 'DELETE', headers })
  console.log('revoke status', revoke.status)

  console.log('poll introspect on', base1)
  const deadline = Date.now() + 15000
  let last = null
  let ok = false
  while (Date.now() < deadline) {
    const r = await fetch(base1 + '/internal/api/tokens/introspect', { method: 'POST', headers, body: JSON.stringify({ token }) })
    const j = await r.json().catch(() => null)
    last = j
    if (j && j.active === false) { ok = true; break }
    await new Promise(r => setTimeout(r, 200))
  }
  console.log('result', ok ? 'revoked' : 'not-revoked', 'last', last)
  if (!ok) process.exit(1)
  process.exit(0)
})()
