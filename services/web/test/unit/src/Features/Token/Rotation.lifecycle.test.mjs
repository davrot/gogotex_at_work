import { expect } from 'chai'
import { describe, it, beforeEach, afterEach, vi } from 'vitest'

// Additional lifecycle tests for token behaviors (T015 acceptance criteria)
vi.mock('../../../../../app/src/models/PersonalAccessToken.js', () => {
  class MockPAT {
    constructor(doc) { Object.assign(this, doc); this._id = (Math.floor(Math.random()*100000)).toString(36) }
    async save() { const obj = Object.assign({}, this); MockPAT._store.push(obj); return obj }
    static async create(doc) { const d = new MockPAT(doc); await d.save(); return d }
    static find() { const arr = MockPAT._store.slice(); const q = { lean: async () => arr, exec: async () => arr }; q.then = (r, j) => Promise.resolve(arr).then(r, j); return q }
    static async findOneAndUpdate(q, u) { const idx = MockPAT._store.findIndex(d => String(d._id) === String(q._id)); if (idx !== -1) { Object.assign(MockPAT._store[idx], u); return MockPAT._store[idx] } return null }
    static _store = []
  }
  return { default: MockPAT, PersonalAccessToken: MockPAT }
})

// Mock bcrypt to make tests deterministic and fast
vi.doMock('bcrypt', () => ({ hash: async () => '$2$mock', compare: async () => true }))
// Use a spy for pubsub.publish so tests can assert invalidation messages are emitted
const publishSpy = vi.fn()
vi.doMock('../../../../../app/src/lib/pubsub.js', () => ({ publish: publishSpy }))

import * as PAMod from '../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
const PersonalAccessTokenManager = PAMod.default || PAMod

describe('PersonalAccessToken lifecycle extra tests (T015)', function () {
  let origSave, origFind, origFindOneAndUpdate
  beforeEach(function () {
    // Reset in-memory store and patch mongoose to avoid touching real DB
    global.__TEST_PAT_STORE = []
    const mongoosePkg = require('mongoose')
    origSave = mongoosePkg.Model.prototype.save
    origFind = mongoosePkg.Model.find
    origFindOneAndUpdate = mongoosePkg.Model.findOneAndUpdate

    mongoosePkg.Model.prototype.save = async function () {
      this._id = this._id || (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString(36)
      this.createdAt = this.createdAt || new Date()
      this.userId = this.userId || '507f1f77bcf86cd799439011'
      const saved = (typeof this.toObject === 'function') ? this.toObject() : Object.assign({}, this)
      global.__TEST_PAT_STORE.push(saved)
      return saved
    }

    mongoosePkg.Model.find = function (query) {
      const arr = (global.__TEST_PAT_STORE || []).filter(d => {
        if (query.userId && String(d.userId) !== String(query.userId)) return false
        if (query.label && d.label !== query.label) return false
        if (query.active != null && d.active !== query.active) return false
        if (query.hashPrefix && d.hashPrefix !== query.hashPrefix) return false
        return true
      })
      const obj = {
        lean: async () => arr,
        exec: async () => arr,
        sort: function () { return this },
      }
      obj.then = (resolve, reject) => Promise.resolve(arr).then(resolve, reject)
      return obj
    }

    mongoosePkg.Model.findOneAndUpdate = async function (q, update) {
      const idx = (global.__TEST_PAT_STORE || []).findIndex(d => String(d._id) === String(q._id) || (q.userId && String(d.userId) === String(q.userId) && d.label === q.label))
      if (idx !== -1) {
        Object.assign(global.__TEST_PAT_STORE[idx], update)
        return global.__TEST_PAT_STORE[idx]
      }
      return null
    }
  })

  afterEach(function () {
    // restore mongoose originals
    try {
      const mongoosePkg = require('mongoose')
      mongoosePkg.Model.prototype.save = origSave
      mongoosePkg.Model.find = origFind
      mongoosePkg.Model.findOneAndUpdate = origFindOneAndUpdate
    } catch (e) {
      // Ignore restore errors in weird test environments
    }
    // clear store
    global.__TEST_PAT_STORE = []
  })

  afterEach(function () {
    // nothing special
  })

  it('stores algorithm and hashPrefix metadata and introspection returns correct active flags', async function () {
    process.env.AUTH_TOKEN_HASH_ALGO = 'bcrypt'
    process.env.AUTH_TOKEN_BCRYPT_COST = '1'
    const userId = '507f1f77bcf86cd799439011'

    const res1 = await PersonalAccessTokenManager.createToken(userId, { label: 't1' })
    expect(res1).to.have.property('token')

    // Patch the runtime pubsub instance used by the manager so we can observe publishes
    try {
      const pub = require('../../../../../app/lib/pubsub.js')
      pub.publish = publishSpy
    } catch (e) {
      // ignore if not present in this test environment
    }

    const res2 = await PersonalAccessTokenManager.createToken(userId, { label: 't1', replace: true })
    expect(res2).to.have.property('token')

    // introspect metadata for new token
    const infoNew = await PersonalAccessTokenManager.introspect(res2.token)
    expect(infoNew).to.be.an('object')
    expect(infoNew).to.have.property('active', true)
    expect(infoNew).to.have.property('hashPrefix').that.is.a('string')

    // Verify that stored metadata includes algorithm and hashPrefix (inspect in-memory store)
    const stored = global.__TEST_PAT_STORE.find(d => String(d._id) === String(res2.id))
    expect(stored).to.be.ok
    expect(stored).to.have.property('algorithm').that.is.a('string')
    expect(stored).to.have.property('hashPrefix').that.is.a('string')

    // Verify listTokens returns the new token and flags correctly
    const list = await PersonalAccessTokenManager.listTokens(userId)
    expect(list).to.be.an('array')
    const foundNew = list.find(t => t.hashPrefix === stored.hashPrefix)
    expect(foundNew).to.be.ok
    expect(foundNew.active).to.equal(true)

    // Introspect old token - should be inactive after replace
    const infoOld = await PersonalAccessTokenManager.introspect(res1.token)
    expect(infoOld).to.be.an('object')
    expect(infoOld).to.have.property('active', false)

    // Additionally, test revokeToken publishes an invalidation message (explicit revoke path)
    try {
      const pub = require('../../../../../app/lib/pubsub.js')
      pub.publish = publishSpy
    } catch (e) {}
    await PersonalAccessTokenManager.revokeToken(userId, res1.id)
    expect((publishSpy && publishSpy.mock && publishSpy.mock.calls.length) || (publishSpy && publishSpy.calls && publishSpy.calls.length) || 0).to.be.greaterThan(0)
    const pubArgs = (publishSpy && publishSpy.mock && publishSpy.mock.calls[0]) || (publishSpy && publishSpy.calls && publishSpy.calls[0])
    expect(pubArgs[0]).to.equal('auth.cache.invalidate')
    expect(pubArgs[1]).to.have.property('type').that.includes('token.revoked')
  }, 20000)

  it('handles malformed token input gracefully (negative test)', async function () {
    const res = await PersonalAccessTokenManager.introspect('not-a-valid-token')
    // Expect introspect to return inactive info instead of throwing
    expect(res).to.be.ok
    expect(res).to.have.property('active')
  }, 20000)
})
