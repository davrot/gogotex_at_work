import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

// NOTE: This test asserts synchronous revocation semantics for the immediate
// introspection path on the same-instance test harness. For full cross-instance
// validation, extend this test to run against a multi-instance harness that
// shares Redis pubsub (see tasks T016b/T016c).

describe('Token revocation immediacy', function () {
  this.timeout(60 * 1000)

  it('create -> introspect(active:true) -> delete -> introspect(active:false) immediately', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create token
    const { response: createResp, body: createBody } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'revocation-test' },
    })
    expect([200, 201]).to.include(createResp.statusCode)
    const plaintext = createBody && (createBody.token || createBody.plaintext || createBody.token)

    // sanity check: introspect sees token as active (call as service-origin basic auth)
    const adminCred = Object.entries((await import('@overleaf/settings')).default.httpAuthUsers)[0]
    const [adminUser, adminPass] = adminCred
    const { response: introspectRespBefore, body: introspectBodyBefore } = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token: plaintext }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(introspectRespBefore.statusCode).to.equal(200)
    expect(introspectBodyBefore.active).to.equal(true)

    // delete token
    await user.getCsrfToken()
    const del = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${createBody.id}` })
    expect([204, 200]).to.include(del.response.statusCode)

    // immediate introspect should show inactive (call as service-origin basic auth)
    const { response: introspectRespAfter, body: introspectBodyAfter } = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token: plaintext }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
    expect(introspectRespAfter.statusCode).to.equal(200)
    expect(introspectBodyAfter.active).to.equal(false)

    // TODO: extend to multi-instance harness (spin up a second web instance
    // connected to the same Redis and perform cross-instance introspection).
  })
})
