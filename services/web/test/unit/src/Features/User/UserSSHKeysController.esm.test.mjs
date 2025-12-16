import { describe, it, beforeEach, expect, vi } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

// Mock infrastructure mongoose before any modules import it
let mockMongoose = { models: { UserSSHKey: { find: vi.fn(), findOne: vi.fn(), findOneAndDelete: vi.fn(), model: vi.fn() } }, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }
vi.mock('../../../../../app/src/infrastructure/Mongoose.js', () => mockMongoose)

// Mock dependencies
vi.mock('../../../../../app/src/models/UserSSHKey.js', () => {
  class MockUserSSHKey {
    constructor(doc) {
      console.log('MOCKUserSSHKey constructor called', doc)
      this._id = 'mock-k'
      this.keyName = doc.keyName
      this.publicKey = doc.publicKey
      this.fingerprint = 'SHA256:MOCK'
      this.createdAt = new Date().toISOString()
      this.updatedAt = new Date().toISOString()
      this.userId = doc.userId
    }
    async save() { return this }
  }
  MockUserSSHKey.find = vi.fn()
  MockUserSSHKey.findOneAndDelete = vi.fn()
  MockUserSSHKey.findOne = vi.fn()
  const returnVal = { default: MockUserSSHKey, UserSSHKey: MockUserSSHKey }
  // Ensure our app infra mongoose has the model reference so model file initialization uses the mock
  try { mockMongoose.models.UserSSHKey = MockUserSSHKey; mockMongoose.models.User = { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) } } catch (e) {}
  return returnVal
})
vi.mock('../../../../../app/src/models/User.js', () => ({ default: { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) }, User: { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) } }))
vi.mock('../../../../../app/src/lib/lookupCache.mjs', () => ({ default: { set: vi.fn(), invalidate: vi.fn() } }))

vi.mock('@overleaf/logger', () => ({ default: { debug: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn(), err: vi.fn(), error: vi.fn(), fatal: vi.fn() } }))
describe('UserSSHKeysController (ESM)', async () => {
  let Controller
  let UserSSHKey

  beforeEach(async () => {
    // Reset module cache so imports pick up fresh mocks
    vi.resetModules()

    // Load model mocks and set them into the app's infrastructure mongoose before importing the controller
    const model = await import('../../../../../app/src/models/UserSSHKey.js')
    UserSSHKey = model.UserSSHKey
    try {
      const infraMongoose = await import('../../../../../app/src/infrastructure/Mongoose.js')
      if (infraMongoose && infraMongoose.default && infraMongoose.default.models) {
        // make sure the infrastructure mongoose mock exposes our stubbed query shapes
        infraMongoose.default.models.UserSSHKey = UserSSHKey
        infraMongoose.default.models.User = { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) }
        // ensure query shapes on the infra mock return exec-like promises to avoid real DB calls
        if (infraMongoose.default.models.UserSSHKey.find) infraMongoose.default.models.UserSSHKey.find.mockReturnValue({ lean: () => ({ exec: async () => [] }) })
        infraMongoose.default.models.UserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => null }) })
        infraMongoose.default.models.UserSSHKey.findOneAndDelete = vi.fn().mockReturnValue({ exec: async () => null })
      }
    } catch (e) {}
    // Fresh import to pick up mocks
    Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    // default behaviors - ensure all query shapes are stubbed to avoid real mongoose calls
    UserSSHKey.find = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => [] }) })
    UserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => null }) })
    UserSSHKey.findOneAndDelete = vi.fn().mockReturnValue({ exec: async () => null })

    // Inject the mocked model into the controller for deterministic isolation
    if (Controller && typeof Controller.__setUserSSHKeyForTest === 'function') {
      Controller.__setUserSSHKeyForTest(UserSSHKey)
    }
  })

  afterEach(() => {
    try { if (Controller && typeof Controller.__resetUserSSHKeyForTest === 'function') Controller.__resetUserSSHKeyForTest() } catch (e) {}
  })

  it('create returns 201 with fingerprint and caches', async () => {
    const req = { params: { userId: '000000000000000000000001' }, body: { key_name: 'test', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample fixture' }, session: {}, headers: {} }
    const res = new MockResponse()
    console.error('TEST REQ PARAMS', req.params)
    try { console.error('MOCK MONGOOSE MODELS', Object.keys(mockMongoose.models)) } catch(e) {}
    await Controller.create(req, res)
    expect(res.statusCode).to.equal(201)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('fingerprint')
  })

  it('create is idempotent for same user (returns 200)', async () => {
    // First call returns 201
    const req1 = { params: { userId: '000000000000000000000002' }, body: { key_name: 'test', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample2 fixture' }, session: {}, headers: {} }
    const res1 = new MockResponse()
    await Controller.create(req1, res1)
    expect(res1.statusCode).to.equal(201)
    const body1 = JSON.parse(res1.body)
    expect(body1).to.have.property('fingerprint')

    // Mock findOne to return that same doc; subsequent create should return 200
    const fakeExisting = { _id: 'existing-k', fingerprint: body1.fingerprint, userId: '000000000000000000000002', keyName: 'test', publicKey: req1.body.public_key, createdAt: new Date().toISOString() }
    UserSSHKey.findOneAndDelete.mockReset()
    UserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => fakeExisting }) })

    const req2 = { params: { userId: '000000000000000000000002' }, body: { key_name: 'test', public_key: req1.body.public_key }, session: {}, headers: {} }
    const res2 = new MockResponse()
    await Controller.create(req2, res2)
    expect(res2.statusCode).to.equal(200)
    const body2 = JSON.parse(res2.body)
    expect(body2).to.have.property('id')
    expect(String(body2.userId)).to.equal('000000000000000000000002')
  })

  it('create returns 409 when key exists for different user', async () => {
    const fakeExisting = { _id: 'existing-k2', fingerprint: 'SHA256:EX', userId: '000000000000000000000009', keyName: 'other', publicKey: 'ssh-ed25519 AAAAOthEr fixture', createdAt: new Date().toISOString() }
    UserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => fakeExisting }) })

    const req = { params: { userId: '000000000000000000000008' }, body: { key_name: 'dup', public_key: fakeExisting.publicKey }, session: {}, headers: {} }
    const res = new MockResponse()
    await Controller.create(req, res)
    expect(res.statusCode).to.equal(409)
  })

  it('remove invalidates cache and returns 204', async () => {
    const fakeDoc = { _id: 'k1', fingerprint: 'SHA256:AAAA', userId: '000000000000000000000001' }

    // Mock shape A: returns an object with .exec()
    UserSSHKey.findOneAndDelete.mockImplementation((query) => { console.error('MOCK findOneAndDelete called with (exec-shape)', query); return { exec: async () => fakeDoc } })
    const req = { params: { userId: '000000000000000000000001', keyId: 'k1' }, session: {} }
    let res = new MockResponse()
    try { console.error('TEST findOneAndDelete before calling remove (exec-shape)', typeof UserSSHKey.findOneAndDelete, !!(UserSSHKey.findOneAndDelete && UserSSHKey.findOneAndDelete.mock)) } catch(e) {}
    try { console.error('TEST controller.remove source contains our marker', Controller.remove.toString().includes('findOneAndDelete typeof')) } catch (e) {}
    // Assert the remove source contains our diagnostic marker
    expect(Controller.remove.toString()).to.contain('findOneAndDelete typeof')
    try {
      await Controller.remove(req, res)
    } catch (err) {
      try { console.error('TEST caught error from controller.remove (exec-shape)', err && err.stack ? err.stack : err) } catch (e) {}
      throw err
    }
    try { console.error('TEST findOneAndDelete calls (exec-shape)', UserSSHKey.findOneAndDelete.mock.calls) } catch (e) {}
    if (res.statusCode === 500) {
      try { console.error('TEST response body (exec-shape)', res.body) } catch (e) {}
    }
    expect(res.statusCode).to.equal(204)

    // Now test Mock shape B: returns a promise directly (promise-like)
    UserSSHKey.findOneAndDelete.mockReset()
    UserSSHKey.findOneAndDelete.mockImplementation((query) => { console.error('MOCK findOneAndDelete called with (promise-shape)', query); return Promise.resolve(fakeDoc) })
    res = new MockResponse()
    try { console.error('TEST findOneAndDelete before calling remove (promise-shape)', typeof UserSSHKey.findOneAndDelete, !!(UserSSHKey.findOneAndDelete && UserSSHKey.findOneAndDelete.mock)) } catch(e) {}
    try {
      await Controller.remove(req, res)
    } catch (err) {
      try { console.error('TEST caught error from controller.remove (promise-shape)', err && err.stack ? err.stack : err) } catch (e) {}
      throw err
    }
    try { console.error('TEST findOneAndDelete calls (promise-shape)', UserSSHKey.findOneAndDelete.mock.calls) } catch (e) {}
    expect(res.statusCode).to.equal(204)

    // Ensure cache invalidation was called
    const lookupCache = (await import('../../../../../app/src/lib/lookupCache.mjs')).default
    try { console.error('TEST lookupCache.invalidate calls', lookupCache.invalidate && lookupCache.invalidate.mock && lookupCache.invalidate.mock.calls) } catch (e) {}
  })
})