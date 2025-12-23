import { expect } from 'chai'

// This test compares token listing behavior between Node (services/web) and Go (webprofile API).
// Requires env vars NODE_BASE and GO_BASE pointing to the two services (full URL without trailing slash)
// Example: NODE_BASE=http://develop-web-1:3000 GO_BASE=http://webprofile-api-parity:3900 npm run test:contract -- --grep TokenListParityTest

const nodeBase = process.env.NODE_BASE
const goBase = process.env.GO_BASE
if (!nodeBase || !goBase) {
  describe('Token list parity (skipped)', function () {
    it('skipping because NODE_BASE and GO_BASE are not set', function () {
      this.skip()
    })
  })
} else {
  describe('Token list parity', function () {
    this.timeout(30 * 1000)

    it('create tokens on Node & Go and compare list responses', async function () {
      const userId = `parity-list-${Date.now()}`
      // create token on Node
      const createNode = await fetch(`${nodeBase}/internal/api/users/${userId}/git-tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'parity-node', scopes: ['repo:read'] }), credentials: 'omit' })
      expect([200, 201]).to.include(createNode.status)
      const nodeBody = await createNode.json()

      // create token on Go
      const createGo = await fetch(`${goBase}/internal/api/users/${userId}/git-tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') }, body: JSON.stringify({ label: 'parity-go', scopes: ['repo:read'] }) })
      expect([200, 201]).to.include(createGo.status)
      const goBody = await createGo.json()

      // fetch lists
      const listNode = await fetch(`${nodeBase}/internal/api/users/${userId}/git-tokens`, { method: 'GET', headers: { 'Authorization': 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } })
      expect(listNode.status).to.equal(200)
      const nodeList = await listNode.json()

      const listGo = await fetch(`${goBase}/internal/api/users/${userId}/git-tokens`, { method: 'GET', headers: { 'Authorization': 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } })
      expect(listGo.status).to.equal(200)
      const goList = await listGo.json()

      // Compare high-level shapes
      expect(Array.isArray(nodeList)).to.equal(true)
      expect(Array.isArray(goList)).to.equal(true)

      // Ensure both lists contain at least one token for this user
      const nodeIds = nodeList.map((t) => String(t.id || t._id || t.id))
      const goIds = goList.map((t) => String(t.id || t._id || t.id))

      expect(nodeIds.length).to.be.greaterThan(0)
      expect(goIds.length).to.be.greaterThan(0)

      // Basic parity: both sides should expose label and scopes on list entries (masking may apply)
      const nodeSample = nodeList[0]
      const goSample = goList[0]
      expect(nodeSample).to.have.property('label')
      expect(goSample).to.have.property('label')
      expect(nodeSample).to.have.property('scopes')
      expect(goSample).to.have.property('scopes')

      // Cleanup is best-effort (attempt to revoke the created tokens)
      try { await fetch(`${nodeBase}/internal/api/users/${userId}/git-tokens/${nodeBody.id}`, { method: 'DELETE', headers: { 'Authorization': 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } }) } catch (e) {}
      try { await fetch(`${goBase}/internal/api/users/${userId}/git-tokens/${goBody.id}`, { method: 'DELETE', headers: { 'Authorization': 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } }) } catch (e) {}
    })
  })
}
