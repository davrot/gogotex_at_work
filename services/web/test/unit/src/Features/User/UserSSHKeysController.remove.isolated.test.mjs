import { describe, it, expect, vi, beforeEach } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

const lookupCacheMock = { set: vi.fn(), invalidate: vi.fn() }

vi.mock('../../../../../app/src/infrastructure/Mongoose.js', () => ({ models: {}, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }))
vi.mock('@overleaf/settings', () => ({ default: { mongo: { url: 'mongodb://mongo:27017/test', options: {} } } }))
// Also mock the real infrastructure Mongoose file by absolute path(s) to avoid it executing
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/infrastructure/Mongoose.js', () => ({ models: {}, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }))
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/infrastructure/Mongoose', () => ({ models: {}, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }))

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
    vi.mock('../../../../../app/src/lib/lookupCache.mjs', () => ({ default: lookupCacheMock }))
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
      // Ensure the model's findOneAndDelete returns an exec-like shape
      const MockModel = (await import('../../../../../app/src/models/UserSSHKey.js')).UserSSHKey
      MockModel.findOneAndDelete = vi.fn().mockImplementation(() => ({ exec: async () => fakeDoc }))
      // Tell controller to use our injected lookup cache mock
      Controller.__setLookupCacheForTest(lookupCacheMock)
      await Controller.remove(req, res)
      Controller.__resetLookupCacheForTest()
      expect(res.statusCode).to.equal(204)

      expect(lookupCacheMock.invalidate).to.have.property('mock')
      expect(lookupCacheMock.invalidate.mock.calls.length).to.be.at.least(1)
      // Ensure one of the calls included the expected fingerprint
      expect(lookupCacheMock.invalidate.mock.calls.some(c => c[0] === fakeDoc.fingerprint)).to.equal(true)
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
      // Ensure the model's findOneAndDelete returns a promise-like shape
      const MockModel = (await import('../../../../../app/src/models/UserSSHKey.js')).UserSSHKey
      MockModel.findOneAndDelete = vi.fn().mockImplementation(() => Promise.resolve(fakeDoc))
      Controller.__setLookupCacheForTest(lookupCacheMock)
      await Controller.remove(req, res)
      Controller.__resetLookupCacheForTest()
      expect(res.statusCode).to.equal(204)
      expect(lookupCacheMock.invalidate).to.have.property('mock')
      expect(lookupCacheMock.invalidate.mock.calls.length).to.be.at.least(1)
      // Ensure one of the calls included the expected fingerprint
      expect(lookupCacheMock.invalidate.mock.calls.some(c => c[0] === fakeDoc.fingerprint)).to.equal(true)
    } finally {
      QueryProto.exec = origExec
    }
  })
})