import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Token introspection integration tests', function () {
  this.timeout(60 * 1000)

  it('introspects a valid token via internal API and returns expected JSON', async function () {
    const user = new UserHelper()
    await user.register()

    // create a token via API
    const { response, body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.user._id}/git-tokens`,
      json: { label: 'integration-introspect' },
    })
    expect([200, 201]).to.include(response.statusCode)
    const token = body && body.plaintext
    expect(token).to.be.a('string')

    // call introspect as a service-origin (basic auth)
    const adminCred = Object.entries((await import('@overleaf/settings')).default.httpAuthUsers)[0]
    const [adminUser, adminPass] = adminCred
    const res = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(res.response.statusCode).to.equal(200)
    expect(res.body).to.have.property('active')
    expect(res.body.active).to.be.true
    expect(res.body).to.have.property('userId')
    expect(String(res.body.userId)).to.equal(String(user.user._id))
  })
})