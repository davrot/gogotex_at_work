import { describe, it, expect, vi, beforeEach } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

describe('UserSSHKeysController.remove (isolated)', () => {
  let Controller
  beforeEach(async () => {
    vi.resetModules()
    // Mock UserSSHKey model before importing controller
    vi.mock('../../../../../app/src/models/UserSSHKey.js', () => {
      class MockUserSSHKey {}
      MockUserSSHKey.findOneAndDelete = vi.fn()
      return { default: MockUserSSHKey, UserSSHKey: MockUserSSHKey }
    })
    vi.mock('../../../../../app/src/lib/lookupCache.mjs', () => ({ default: { set: vi.fn(), invalidate: vi.fn() } }))
    vi.mock('@overleaf/logger', () => ({ default: { info: vi.fn(), err: vi.fn() } }))

    Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
  })

  it('returns 204 and invalidates cache when findOneAndDelete returns doc (exec shape)', async () => {
    const fakeDoc = { _id: 'k1', fingerprint: 'SHA256:FAKEFP', userId: 'u1' }
    // Monkey-patch mongoose Query.exec to return our fakeDoc and avoid DB access
    const mongoose = await import('mongoose')
    const QueryProto = mongoose.Query && mongoose.Query.prototype
    const origExec = QueryProto.exec
    QueryProto.exec = async function () { return fakeDoc }

    try {
      const req = { params: { userId: '000000000000000000000001', keyId: '000000000000000000000011' }, session: {} }
      const res = new MockResponse()
      await Controller.remove(req, res)
      expect(res.statusCode).to.equal(204)

      const lookupCache = (await import('../../../../../app/src/lib/lookupCache.mjs')).default
      expect(lookupCache.invalidate).to.have.property('mock')
      expect(lookupCache.invalidate.mock.calls.length).to.equal(1)
      expect(lookupCache.invalidate.mock.calls[0][0]).to.equal(fakeDoc.fingerprint)
    } finally {
      QueryProto.exec = origExec
    }
  })

  it('returns 204 when findOneAndDelete returns a promise resolving to doc (promise shape)', async () => {
    const fakeDoc = { _id: 'k2', fingerprint: 'SHA256:FP2', userId: 'u2' }
    // Monkey-patch mongoose Query.exec to return our fakeDoc and avoid DB access
    const mongoose = await import('mongoose')
    const QueryProto = mongoose.Query && mongoose.Query.prototype
    const origExec = QueryProto.exec
    QueryProto.exec = async function () { return fakeDoc }

    try {
      const req = { params: { userId: '000000000000000000000002', keyId: '000000000000000000000022' }, session: {} }
      const res = new MockResponse()
      await Controller.remove(req, res)
      expect(res.statusCode).to.equal(204)
      const lookupCache = (await import('../../../../../app/src/lib/lookupCache.mjs')).default
      expect(lookupCache.invalidate).to.have.property('mock')
      expect(lookupCache.invalidate.mock.calls.length).to.equal(1)
      expect(lookupCache.invalidate.mock.calls[0][0]).to.equal(fakeDoc.fingerprint)
    } finally {
      QueryProto.exec = origExec
    }
  })
})