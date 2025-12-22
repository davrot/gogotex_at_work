import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Token create/list/remove integration tests', function () {
  this.timeout(60 * 1000)

  it('creates a token, lists it and deletes it', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // DEBUG: print user.id before create
    try { console.error('[TEST] before create user.id=', user.id) } catch (e) {}
    // create token
    const { response: createResp, body: createBody } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'integration-token' },
    })
    expect([200, 201]).to.include(createResp.statusCode)

    // DEBUG: print cookie jar after create to detect any Set-Cookie that changed session
    try { console.error('[TEST] cookies after create:', user.jar.getCookieStringSync(UserHelper.url('/').toString())) } catch (e) {}
    // API should return plaintext token once
    const plaintext = createBody && (createBody.token || createBody.plaintext || createBody.token)
    expect(plaintext).to.be.a('string')
    const tokenId = createBody && (createBody.id || createBody.tokenId)
    expect(tokenId).to.be.a('string')

    // list tokens (as logged in user)
    const { response: listResp, body: listBody } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(listResp.statusCode).to.equal(200)
    expect(Array.isArray(listBody)).to.equal(true)
    const listed = listBody.find(t => t.id === tokenId)
    expect(listed).to.not.equal(undefined)
    expect(listed).to.have.property('hashPrefix')

    // DEBUG: print cookie jar after list to detect any session cookie changes
    try { console.error('[TEST] cookies after list:', user.jar.getCookieStringSync(UserHelper.url('/').toString())) } catch (e) {}

    // delete token
    // DEBUG: print tokenId and delete URL to help triage 404
    try { console.error('[TEST] delete tokenId=', tokenId, 'url=', `/internal/api/users/${user.id}/git-tokens/${tokenId}`) } catch (e) {}
    // DEBUG: check session state just before delete so we can see whether the cookie/session is still valid
    try {
      const sessionObj = await user.getSession().catch(e => { console.error('[TEST] getSession threw', e && (e.stack || e)); return null })
      try { console.error('[TEST] session before delete:', sessionObj) } catch (e) {}
    } catch (e) { console.error('[TEST] getSession error', e && (e.stack || e)) }

    // DEBUG: try raw fetch with x-debug-echo header to see if server receives the request
    try {
      const echoResp = await user.fetch(`/internal/api/users/${user.id}/git-tokens/${tokenId}`, { method: 'DELETE', headers: { 'x-debug-echo': '1' } })
      try { const echoBody = await echoResp.json().catch(() => null); console.error('[TEST] echoResp status=', echoResp.status, 'body=', echoBody) } catch (e) {}
    } catch (e) { console.error('[TEST] echo fetch threw', e && (e.stack || e)) }

    // DEBUG: try raw fetch without debug header to see actual delete response
    try {
      const rawResp = await user.fetch(`/internal/api/users/${user.id}/git-tokens/${tokenId}`, { method: 'DELETE' })
      const rawText = await rawResp.text().catch(() => null)
      console.error('[TEST] raw DELETE status=', rawResp.status, 'body=', rawText)
    } catch (e) { console.error('[TEST] raw delete threw', e && (e.stack || e)) }

    // DEBUG: inspect how the server decodes the session cookie and what is in redis for it
    try {
      const inspectResp = await user.doRequest('get', { url: `/internal/api/debug/inspect-session` })
      try { console.error('[TEST] inspectSession resp=', inspectResp.response && inspectResp.body ? inspectResp.body : inspectResp) } catch (e) {}
    } catch (e) { console.error('[TEST] inspect session threw', e && (e.stack || e)) }

    // Ensure a fresh CSRF token for delete
    await user.getCsrfToken()
    const del = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${tokenId}` })
    // deletion returns 204 when successful
    expect([204, 200]).to.include(del.response.statusCode)

    // after delete, list should not include active token
    const { response: list2Resp, body: list2Body } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(list2Resp.statusCode).to.equal(200)
    const still = list2Body.find(t => t.id === tokenId)
    // token may be removed or marked inactive depending on implementation; ensure it's not active
    if (still) {
      expect(still.active === false).to.equal(true)
    }
  })
})
