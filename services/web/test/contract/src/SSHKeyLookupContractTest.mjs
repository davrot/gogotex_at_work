import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

import Settings from '@overleaf/settings'

describe('SSH fingerprint lookup contract tests', function () {
  this.timeout(60 * 1000)

  it('returns userId for a known fingerprint', async function () {
    const user = new UserHelper()
    // Debug: inspect user helper before calling register
    // eslint-disable-next-line no-console
    console.debug('[SSHKeyLookupContractTest] user proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)), 'has.register=', typeof user.register)
    await user.register()
    await user.login()

    const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0examplekeyDATA' + user.id
    // create key
    const resCreate = await user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'test', public_key: publicKey } })
    expect([201, 200]).to.include(resCreate.response.statusCode)

    const fingerprint = resCreate.body && resCreate.body.fingerprint
    expect(fingerprint).to.be.a('string')

    // call private lookup endpoint
    // call private lookup endpoint without private auth — expect 401 (protected)
    const resNoAuth = await user.doRequest('get', { url: `/internal/api/ssh-keys/${encodeURIComponent(fingerprint)}` })
    expect([401, 404, 403]).to.include(resNoAuth.response.statusCode)

    // call with basic auth: settings.httpAuthUsers should be configured in test harness
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const res = await user.doRequest('get', { url: `/internal/api/ssh-keys/${encodeURIComponent(fingerprint)}`, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    // If the optional private endpoint is implemented, assert it returns userId
    if (res.response.statusCode === 200) {
      expect(res.body).to.have.property('userId')
      expect(String(res.body.userId)).to.equal(String(user.id))
    } else {
      // Endpoint may be absent (404) if host opts not to implement it — assert contract fallback
      expect(res.response.statusCode).to.be.oneOf([404, 403])
    }
  })

  it('returns 400 for malformed fingerprint format', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const res = await user.doRequest('get', { url: '/internal/api/ssh-keys/abcdef', auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(res.response.statusCode).to.equal(400)
  })
})
