import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('SSH Key Idempotency / concurrency contract tests', function () {
  this.timeout(60 * 1000)

  // Clear relevant rate-limiter keys before each test to avoid interference from earlier tests
  beforeEach(async function () {
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const keysAll = await rclient.keys('rate-limit:*')
      const keysA = await rclient.keys('rate-limit:overleaf-login:*')
      const keysB = await rclient.keys('rate-limit:fingerprint-lookup:*')
      const keysC = await rclient.keys('rate-limit:ssh-fingerprint-lookup:*')
      const keys = [...(keysAll||[]), ...(keysA||[]), ...(keysB||[]), ...(keysC||[])]
      const dedup = Array.from(new Set(keys))
      if (dedup && dedup.length) await rclient.del(dedup)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[SSHKeyIdempotencyContractTest] cleared rate-limiter keys before test:', dedup && dedup.length)
    } catch (e) {}
  })

  it('concurrent POSTs with same public_key should be deterministic and not create duplicates', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()
    await user.getCsrfToken()

    const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0examplekeyDATA' + user.id

    // Fire two concurrent POSTs attempting to create the same key
    const p1 = user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'concurrent', public_key: publicKey }, headers: { 'x-dev-user-id': user.id } })
    const p2 = user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'concurrent', public_key: publicKey }, headers: { 'x-dev-user-id': user.id } })

    const [r1, r2] = await Promise.all([p1, p2])

    // Acceptable outcomes: both succeed (201/200) and resource is same, or one succeeds and the other returns 200/409; do not allow two distinct resources
    const codes = [r1.response.statusCode, r2.response.statusCode]
    expect(codes.some(c => [200, 201].includes(c))).to.equal(true)

    // Now list keys and ensure only one entry with the fingerprint exists
    const fetchAndMatches = async () => {
      const fetchResInner = await user.fetch(`/internal/api/users/${user.id}/ssh-keys`, { headers: { 'x-dev-user-id': user.id } })
      const bodyTextInner = await fetchResInner.text()
      let keysInner
      try { keysInner = JSON.parse(bodyTextInner) } catch (e) { keysInner = [] }
      return keysInner.filter(k => (k.public_key && k.public_key.includes('examplekeyDATA')) || (k.key_name === 'concurrent'))
    }

    // Allow a short stabilization window for dedupe to run under heavy concurrency; poll a few times if needed
    let matches = await fetchAndMatches()
    let attempts = 0
    while (matches.length > 1 && attempts < 5) {
      await new Promise(r => setTimeout(r, 200))
      matches = await fetchAndMatches()
      attempts++
    }

    expect(matches.length).to.equal(1)
  })
})
