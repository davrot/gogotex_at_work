import axios from 'axios'
import { expect } from 'chai'

const base = process.env.TARGET_BASE_URL || 'http://localhost:3900'
const adminUser = process.env.WEBPROFILE_ADMIN_USER || 'overleaf'
const adminPass = process.env.WEBPROFILE_ADMIN_PASS || 'overleaf'

/**
 * This test runs a minimal parity smoke against a running webprofile-api shim:
 *  - POST /internal/api/users/:userId/git-tokens => create token
 *  - POST /internal/api/tokens/introspect => expect active:true
 *  - DELETE /internal/api/users/:userId/git-tokens/:tokenId => revoke
 *  - poll POST /internal/api/tokens/introspect until active:false
 *
 * It is intended to be run against a standalone shim (local or in-network) and
 * does not depend on the Node services/web instance. Set TARGET_BASE_URL to
 * point to the shim (default http://localhost:3900).
 */

describe('Webprofile API parity (Go shim) — create/introspect/revoke', function () {
  this.timeout(30 * 1000)

  it('create -> introspect(active:true) -> delete -> introspect(active:false)', async function () {
    const userId = `parity-go-test-${Date.now()}`

    // create token
    const createRes = await axios.post(`${base}/internal/api/users/${userId}/git-tokens`, { label: 'parity-test', scopes: ['repo:read'] }, { auth: { username: adminUser, password: adminPass } })
    expect([200, 201]).to.include(createRes.status)
    const token = createRes.data && (createRes.data.token || createRes.data.plaintext)
    expect(token).to.be.a('string')
    const id = String(createRes.data && createRes.data.id)
    expect(id).to.be.a('string')

    // introspect -> expect active true
    const introspect = await axios.post(`${base}/internal/api/tokens/introspect`, { token }, { auth: { username: adminUser, password: adminPass } })
    expect(introspect.status).to.equal(200)
    expect(introspect.data && introspect.data.active).to.equal(true)

    // revoke
    const revoke = await axios.delete(`${base}/internal/api/users/${userId}/git-tokens/${id}`, { auth: { username: adminUser, password: adminPass } })
    expect(revoke.status).to.equal(204)

    // poll introspect until inactive or timeout
    const deadline = Date.now() + 5000
    let last = null
    let ok = false
    while (Date.now() < deadline) {
      try {
        const r = await axios.post(`${base}/internal/api/tokens/introspect`, { token }, { auth: { username: adminUser, password: adminPass } })
        last = r.data
        if (r.data && r.data.active === false) { ok = true; break }
      } catch (e) {
        last = { error: e.message }
      }
      await new Promise((res) => setTimeout(res, 150))
    }

    expect(ok, `introspect did not reflect revocation within timeout; last=${JSON.stringify(last)}`).to.be.true
  })
})
