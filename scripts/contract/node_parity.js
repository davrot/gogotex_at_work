(async () => {
  const fs = require('fs')
  try {
    const base = process.env.TARGET_BASE_URL || 'http://webprofile-api-parity:3900'
    const auth = 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64')
    const headers = { 'Authorization': auth, 'Content-Type': 'application/json' }
    const userId = 'parity-node-' + Date.now()

    const doFetch = async (url, opts) => fetch(url, opts)

    const writeDiag = (obj) => {
      try {
        fs.mkdirSync('ci/webprofile-parity', { recursive: true })
        fs.writeFileSync('ci/webprofile-parity/node.parity.json', JSON.stringify(obj, null, 2))
      } catch (e) {}
    }

    const createRes = await doFetch(base + '/internal/api/users/' + userId + '/git-tokens', { method: 'POST', headers, body: JSON.stringify({ label: 'parity-test', scopes: ['repo:read'] }) })
    console.log('create status', createRes.status)
    if (![200, 201].includes(createRes.status)) { console.error('create failed'); process.exit(1) }
    const createBody = await createRes.json()
    const token = createBody.token || createBody.plaintext
    const id = String(createBody.id)
    if (!token || !id) { console.error('create response missing token/id', createBody); process.exit(1) }

    const introspect = await (await doFetch(base + '/internal/api/tokens/introspect', { method: 'POST', headers, body: JSON.stringify({ token }) })).json()
    console.log('introspect before revoke', introspect)
    if (!introspect.active) { console.error('introspect before revoke shows inactive'); process.exit(1) }

    const revokeRes = await doFetch(base + '/internal/api/users/' + userId + '/git-tokens/' + id, { method: 'DELETE', headers })
    console.log('revoke status', revokeRes.status)
    if (revokeRes.status !== 204) { console.error('revoke failed'); process.exit(1) }

    const deadline = Date.now() + 15000
    let ok = false
    let last = null
    while (Date.now() < deadline) {
      try {
        const resp = await doFetch(base + '/internal/api/tokens/introspect', { method: 'POST', headers, body: JSON.stringify({ token }) })
        let parsed = null
        try { parsed = await resp.json() } catch (e) { parsed = { _raw: await resp.text() } }
        last = parsed
        if (parsed && parsed.active === false) { ok = true; break }
      } catch (err) {
        last = { error: String(err) }
      }
      await new Promise(r => setTimeout(r, 150))
    }
    console.log('introspect after revoke last', last)
    if (!ok) {
      console.error('revocation not observed in time; last:', last)
      // gather extra info: fetch list endpoint and raw introspect
      let tokenList = null
      try {
        tokenList = await (await doFetch(base + '/internal/api/users/' + userId + '/git-tokens', { method: 'GET', headers })).json()
        console.error('tokens list:', JSON.stringify(tokenList))
      } catch (e) { console.error('failed to fetch tokens list:', String(e)) }
      writeDiag({ timestamp: new Date().toISOString(), last, tokenList })
      process.exit(1)
    }

    console.log('Node parity smoke succeeded')
    writeDiag({ timestamp: new Date().toISOString(), success: true })
    process.exit(0)
  } catch (err) {
    console.error(err)
    try { fs.mkdirSync('ci/webprofile-parity', { recursive: true }) } catch (e) {}
    try { require('fs').writeFileSync('ci/webprofile-parity/node.parity.json', JSON.stringify({ error: String(err) })) } catch (e) {}
    process.exit(2)
  }
})()
