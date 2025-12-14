import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/User.mjs'
import Settings from '@overleaf/settings'

describe('Cache invalidation contract tests', function () {
  this.timeout(60 * 1000)

  it('is protected and requires private auth', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // without auth should be protected
    const unauth = await user.doRequest('post', { url: '/internal/api/cache/invalidate', json: { channel: 'auth.cache.invalidate', key: 'token:abc' } })
    expect([401, 403]).to.include(unauth.response.statusCode)

    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]

    // missing fields -> 400
    const bad = await user.doRequest('post', { url: '/internal/api/cache/invalidate', json: {}, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(bad.response.statusCode).to.equal(400)

    // valid call -> 204 or 200 depending on implementation
    const ok = await user.doRequest('post', { url: '/internal/api/cache/invalidate', json: { channel: 'auth.cache.invalidate', key: 'token:abc' }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect([204, 200]).to.include(ok.response.statusCode)
  })
})