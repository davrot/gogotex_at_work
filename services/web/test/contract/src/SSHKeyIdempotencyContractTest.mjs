import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('SSH Key Idempotency / concurrency contract tests', function () {
  this.timeout(60 * 1000)

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
    const fetchRes = await user.fetch(`/internal/api/users/${user.id}/ssh-keys`, { headers: { 'x-dev-user-id': user.id } })
    const bodyText = await fetchRes.text()
    let keys
    try { keys = JSON.parse(bodyText) } catch (e) { keys = [] }

    // Filter keys by public_key content (defensive: some servers may omit public_key in list)
    const matches = keys.filter(k => (k.public_key && k.public_key.includes('examplekeyDATA')) || (k.key_name === 'concurrent'))
    expect(matches.length).to.equal(1)
  })
})
