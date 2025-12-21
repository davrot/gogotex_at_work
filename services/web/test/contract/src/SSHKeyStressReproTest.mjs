import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('SSH Key Idempotency stress repro', function () {
  this.timeout(20000)

  it('concurrent POSTs with same public_key should be deterministic (stress)', async function () {
    const user = await UserHelper.createUser()
    const salt = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const publicKey = `ssh-rsa ${Buffer.from('overleaf-concurrency-stress-constant-'+salt).toString('base64')}`

    const N = 40
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'stress', public_key: publicKey }, headers: { 'x-dev-user-id': user.id } }))
    }

    const settled = await Promise.allSettled(promises)
    const counts = { ok201: 0, ok200: 0, conflict409: 0, other: 0 }
    for (const p of settled) {
      if (p.status === 'fulfilled') {
        const { response } = p.value
        if (response && response.statusCode === 201) counts.ok201++
        else if (response && response.statusCode === 200) counts.ok200++
        else if (response && response.statusCode === 409) counts.conflict409++
        else counts.other++
      } else {
        counts.other++
      }
    }

    // Give background dedupe a short moment if it is going to run
    await new Promise(r => setTimeout(r, 200))

    // Fetch current list and poll briefly if dedupe is still in progress to avoid
    // flaky failures caused by small timing windows where background dedupe hasn't run yet.
    let listBody
    let listResp
    const maxPollMs = 2000
    const intervalMs = 200
    const start = Date.now()
    while (true) {
      const got = await user.doRequest('get', { url: `/internal/api/users/${user.id}/ssh-keys`, headers: { 'x-dev-user-id': user.id } })
      listResp = got.response
      listBody = got.body
      // Diagnostic echo from server to aid debugging if things go wrong
      try {
        const debugEcho = await user.doRequest('post', { url: '/internal/api/debug/echo', headers: { 'x-dev-user-id': user.id, 'x-debug-echo': '1' }, json: {} })
        try { console.error('SSHKeyStressRepro server-echo=', debugEcho && debugEcho.body) } catch (e) {}
      } catch (e) {
        // ignore debug echo failures
      }

      if (Array.isArray(listBody) && listBody.length === 1) break
      if (Date.now() - start > maxPollMs) break
      await new Promise(r => setTimeout(r, intervalMs))
    }

    // Provide diagnostic output in case of failure
    try { console.error('SSHKeyStressRepro counts=', counts, 'listLength=', Array.isArray(listBody) ? listBody.length : String(listBody)) } catch (e) {}

    expect(Array.isArray(listBody)).to.equal(true)
    expect(listBody.length).to.equal(1)
  })
})