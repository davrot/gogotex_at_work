import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'
import Settings from '@overleaf/settings'

describe('Token introspection contract tests', function () {
  this.timeout(60 * 1000)

  // Clear login rate-limiter keys before each test to avoid test interference
  beforeEach(async function () {
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const loginKeys = await rclient.keys('rate-limit:overleaf-login:*')
      if (loginKeys && loginKeys.length) await rclient.del(loginKeys)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[TokenIntrospectContractTest] cleared overleaf-login keys before test:', loginKeys && loginKeys.length)
    } catch (e) {}
  })

  it('introspects a valid token and returns shape', async function () {
    const password = 'Password-123!'
    const user = await UserHelper.createUser({ password })
    await UserHelper.loginUser({ email: user.email, password })

    // create a token
    const { response, body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'contract-introspect' },
    })
    expect([200, 201]).to.include(response.statusCode)
    const token = body && (body.plaintext || body.token)
    expect(token).to.be.a('string')

    // introspect the token using service-origin/admin auth
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const introspectRes = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(introspectRes.response.statusCode).to.equal(200)
    expect(introspectRes.body).to.have.property('active')
    expect(introspectRes.body).to.have.property('userId')
    expect(String(introspectRes.body.userId)).to.equal(String(user.id))
    expect(introspectRes.body).to.have.property('scopes')
    expect(introspectRes.body).to.have.property('expiresAt')
  })

  it('returns inactive for revoked token', async function () {
    const password = 'Password-123!'
    const user = await UserHelper.createUser({ password })
    await UserHelper.loginUser({ email: user.email, password })

    // create token
    const { body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'contract-introspect-revoke' },
    })
    const token = body && (body.plaintext || body.token)
    expect(token).to.be.a('string')
    // DEBUG: ensure create response contains an id for subsequent revoke
    // eslint-disable-next-line no-console
    console.error('[TokenIntrospectContractTest] create body:', body)

    // revoke via API
    const revokeRes = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${body.id}` })
    // DEBUG: inspect revoke response
    // eslint-disable-next-line no-console
    console.error('[TokenIntrospectContractTest] revokeRes:', revokeRes.response && revokeRes.response.statusCode, revokeRes.body, revokeRes.response && revokeRes.response.request && (revokeRes.response.request.href || revokeRes.response.request.uri && (revokeRes.response.request.uri.protocol + '//' + revokeRes.response.request.uri.host + revokeRes.response.request.uri.path) ) )
    // Canonicalize revoke response: 204 No Content on successful revoke
    expect(revokeRes.response.statusCode).to.equal(204)

    // introspect should be inactive
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const introspectRes2 = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(introspectRes2.response.statusCode).to.equal(200)
    expect(introspectRes2.body && introspectRes2.body.active).to.be.false
  })

  it('allows service-origin basic auth introspection', async function () {
    const password = 'Password-123!'
    const user = await UserHelper.createUser({ password })
    await UserHelper.loginUser({ email: user.email, password })

    // create token
    const { body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'service-auth' },
    })
    const token = body && (body.plaintext || body.token)
    expect(token).to.be.a('string')

    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]

    const res = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(res.response.statusCode).to.equal(200)
    expect(res.body && res.body.active).to.be.true
    expect(res.body).to.have.property('userId')
  })
})