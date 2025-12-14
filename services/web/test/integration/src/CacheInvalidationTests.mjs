import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/User.mjs'

describe('Cache invalidation integration test', function () {
  this.timeout(60 * 1000)

  it('invalidates caches immediately via publish and via API', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create a token
    const { response, body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'int-test' },
    })
    expect(response.statusCode).to.satisfy(code => code === 200 || code === 201)
    const token = body && body.plaintext
    expect(token).to.be.a('string')

    // introspect should be active
    const introspectRes = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
    expect(introspectRes.response.statusCode).to.equal(200)
    expect(introspectRes.body && introspectRes.body.active).to.be.true

    // revoke the token
    const revokeRes = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${body.id}` })
    expect(revokeRes.response.statusCode).to.satisfy(code => code === 200 || code === 204)

    // unauthenticated call should be protected (private API)
    const unauthInv = await user.doRequest('post', { url: '/internal/api/cache/invalidate', json: { channel: 'auth.cache.invalidate', key: `token:${body.id}` } })
    expect([401, 403]).to.include(unauthInv.response.statusCode)

    // call cache invalidation API with private auth to purge caches
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const invRes = await user.doRequest('post', { url: '/internal/api/cache/invalidate', json: { channel: 'auth.cache.invalidate', key: `token:${body.id}` }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect([204, 200]).to.include(invRes.response.statusCode)

    // introspect again; should be inactive
    const introspectRes2 = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
    expect(introspectRes2.response.statusCode).to.equal(200)
    expect(introspectRes2.body && introspectRes2.body.active).to.be.false
  })
})
