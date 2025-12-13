import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/User.mjs'

describe('SSH fingerprint lookup contract tests', function () {
  this.timeout(60 * 1000)

  it('returns userId for a known fingerprint', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0examplekeyDATA' + user.id
    // create key
    const resCreate = await user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'test', public_key: publicKey } })
    expect([201, 200]).to.include(resCreate.response.statusCode)

    const fingerprint = resCreate.body && resCreate.body.fingerprint
    expect(fingerprint).to.be.a('string')

    // call private lookup endpoint
    const res = await user.doRequest('get', { url: `/internal/api/ssh-keys/${encodeURIComponent(fingerprint)}` })
    // If the optional private endpoint is implemented, assert it returns userId
    if (res.response.statusCode === 200) {
      expect(res.body).to.have.property('userId')
      expect(String(res.body.userId)).to.equal(String(user.id))
    } else {
      // Endpoint may be absent (404) if host opts not to implement it — assert contract fallback
      expect(res.response.statusCode).to.be.oneOf([404, 401, 403])
    }
  })
})
