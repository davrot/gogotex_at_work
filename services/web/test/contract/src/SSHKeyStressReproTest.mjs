import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('SSH Key Idempotency stress repro', function () {
  this.timeout(20000)

  it('concurrent POSTs with same public_key should be deterministic (stress)', async function () {
    const user = await UserHelper.createUser()
    const publicKey = `ssh-rsa ${Buffer.from('overleaf-concurrency-stress-constant').toString('base64')}`

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

    const { response: listResp, body: listBody } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/ssh-keys`, headers: { 'x-dev-user-id': user.id } })

    // Provide diagnostic output in case of failure
    try { console.error('SSHKeyStressRepro counts=', counts, 'listLength=', Array.isArray(listBody) ? listBody.length : String(listBody)) } catch (e) {}

    expect(Array.isArray(listBody)).to.equal(true)
    expect(listBody.length).to.equal(1)
  })
})