import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/User.mjs'

describe('Token introspection contract tests', function () {
  this.timeout(60 * 1000)

  it('introspects a valid token and returns shape', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create a token
    const { response, body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'contract-introspect' },
    })
    expect([200, 201]).to.include(response.statusCode)
    const token = body && body.plaintext
    expect(token).to.be.a('string')

    // introspect the token
    const introspectRes = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
    expect(introspectRes.response.statusCode).to.equal(200)
    expect(introspectRes.body).to.have.property('active')
    expect(introspectRes.body).to.have.property('userId')
    expect(String(introspectRes.body.userId)).to.equal(String(user.id))
    expect(introspectRes.body).to.have.property('scopes')
    expect(introspectRes.body).to.have.property('expiresAt')
  })

  it('returns inactive for revoked token', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create token
    const { body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'contract-introspect-revoke' },
    })
    const token = body && body.plaintext
    expect(token).to.be.a('string')

    // revoke via API
    const revokeRes = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${body.id}` })
    expect([200, 204]).to.include(revokeRes.response.statusCode)

    // introspect should be inactive
    const introspectRes2 = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
    expect(introspectRes2.response.statusCode).to.equal(200)
    expect(introspectRes2.body && introspectRes2.body.active).to.be.false
  })
})