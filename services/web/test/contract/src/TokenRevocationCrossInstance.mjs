import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

// Cross-instance revocation immediacy: create token via Node web, revoke via Node, introspect via Go shim
// Requires GO_BASE env var (e.g., http://webprofile-api-ci:3900) and runs in CI/network where both services reachable.
const GO_BASE = process.env.GO_BASE
if (!GO_BASE) {
  describe('Token revocation cross-instance (skipped)', function () {
    it('skip: GO_BASE not set', function () { this.skip() })
  })
} else {
  describe('Token revocation cross-instance', function () {
    this.timeout(60 * 1000)

    it('create->introspect(node:true)->delete(node)->introspect(go:false) immediately', async function () {
      const user = new UserHelper()
      await user.register()
      await user.login()

      const { response: createResp, body: createBody } = await user.doRequest('post', {
        url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'cross-instance' }
      })
      expect([200,201]).to.include(createResp.statusCode)
      const plaintext = createBody && (createBody.plaintext || createBody.token)
      expect(plaintext).to.be.a('string')

      // introspect via Node (admin auth)
      const settings = (await import('@overleaf/settings')).default
      const [adminUser, adminPass] = Object.entries(settings.httpAuthUsers)[0]
      const nodeIntrospect = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token: plaintext }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
      expect(nodeIntrospect.response.statusCode).to.equal(200)
      expect(nodeIntrospect.body && nodeIntrospect.body.active).to.equal(true)

      // revoke via Node
      await user.getCsrfToken()
      const del = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${createBody.id}` })
      expect([204,200]).to.include(del.response.statusCode)

      // introspect via Go shim (service-origin basic auth)
      const basic = 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64')
      const fetch = (await import('node-fetch')).default
      const introspectPayload = { token: plaintext }

      const deadline = Date.now() + 15000
      let last = null
      let ok = false
      while (Date.now() < deadline) {
        const r = await fetch(`${GO_BASE}/internal/api/tokens/introspect`, { method: 'POST', headers: { 'Authorization': basic, 'Content-Type': 'application/json' }, body: JSON.stringify(introspectPayload) })
        const j = await r.json().catch(() => null)
        last = j
        if (j && j.active === false) { ok = true; break }
        await new Promise((res) => setTimeout(res, 200))
      }
      expect(ok, `expected go introspect to reflect revocation; last=${JSON.stringify(last)}`).to.equal(true)

    })
  })
}
