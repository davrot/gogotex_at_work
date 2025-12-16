import { expect } from 'chai'
import { describe, it, beforeAll, afterAll, vi } from 'vitest'

// Mock the PersonalAccessToken mongoose model to avoid touching a real DB in unit tests
vi.mock('../../../../../app/src/models/PersonalAccessToken.js', () => {
  class MockPAT {
    constructor(doc) {
      Object.assign(this, doc)
      this._id = (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString(36)
      this.createdAt = new Date()
      this.expiresAt = doc.expiresAt || null
    }
    async save() {
      // Store a plain POJO so later .lean() returns simple objects
      const obj = (typeof this.toObject === 'function') ? this.toObject() : Object.assign({}, this)
      obj._id = this._id
      obj.createdAt = this.createdAt
      obj.expiresAt = this.expiresAt
      obj.userId = obj.userId || this.userId
      MockPAT._store.push(obj)
      return obj
    }
    static find(query) {
      const arr = MockPAT._store.filter(d => {
        if (query.userId && String(d.userId) !== String(query.userId)) return false
        if (query.label && d.label !== query.label) return false
        if (query.active != null && d.active !== query.active) return false
        if (query.hashPrefix && d.hashPrefix !== query.hashPrefix) return false
        return true
      })
      const q = {
        lean: async () => arr,
        exec: async () => arr,
      }
      q.then = (resolve, reject) => Promise.resolve(arr).then(resolve, reject)
      return q
    }
    static async findOneAndUpdate(q, update) {
      const found = MockPAT._store.find(d => String(d._id) === String(q._id) || (q.userId && String(d.userId) === String(q.userId) && d.label === q.label))
      if (found) {
        Object.assign(found, update)
        return found
      }
      return null
    }
    static _store = []
    // Support create() for code paths that use the static create helper
    static async create(doc) {
      const d = new MockPAT(doc)
      await d.save()
      return d
    }
  }
  return { default: MockPAT, PersonalAccessToken: MockPAT }
})

// Mock bcrypt to avoid expensive hashing in unit tests
vi.doMock('bcrypt', () => ({ hash: async () => '$2$mock', compare: async () => true }))
// Mock pubsub used by the manager to avoid external side-effects/slowness
vi.doMock('../../../../../app/src/lib/pubsub.js', () => ({ publish: () => {} }))

import * as PAMod from '../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
const PersonalAccessTokenManager = PAMod.default || PAMod

describe('PersonalAccessToken rotation behavior', function () {
  beforeAll(async function () { /* DB connection provided by test harness; skip if not present */ })
  afterAll(async function () { /* cleanup handled by test harness */ })

  it('revokes previous token when replace=true', async function () {
    // Ensure we use bcrypt to avoid argon2 availability issues in CI/dev images
    process.env.AUTH_TOKEN_HASH_ALGO = 'bcrypt'
    // Reduce bcrypt cost for test speed
    process.env.AUTH_TOKEN_BCRYPT_COST = '1'
    const userId = '507f1f77bcf86cd799439011'
    // Patch mongoose Model methods to use an in-memory store so tests don't hit real DB
    const mongoosePkg = await import('mongoose')
    const store = []
    const origSave = mongoosePkg.Model.prototype.save
    const origFind = mongoosePkg.Model.find
    const origFindOneAndUpdate = mongoosePkg.Model.findOneAndUpdate
    mongoosePkg.Model.prototype.save = async function () {
      this._id = this._id || (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString(36)
      this.createdAt = this.createdAt || new Date()
      this.userId = this.userId || userId
      const saved = (typeof this.toObject === 'function') ? this.toObject() : Object.assign({}, this)
      store.push(saved)
      return saved
    }
    mongoosePkg.Model.find = function (query) {
      const arr = store.filter(d => {
        if (query.userId && String(d.userId) !== String(query.userId)) return false
        if (query.label && d.label !== query.label) return false
        if (query.active != null && d.active !== query.active) return false
        if (query.hashPrefix && d.hashPrefix !== query.hashPrefix) return false
        return true
      })
      const obj = {
        lean: async () => arr,
        exec: async () => arr,
      }
      obj.then = (resolve, reject) => Promise.resolve(arr).then(resolve, reject)
      return obj
    }
    mongoosePkg.Model.findOneAndUpdate = async function (q, update) {
      const idx = store.findIndex(d => String(d._id) === String(q._id) || (q.userId && String(d.userId) === String(q.userId) && d.label === q.label))
      if (idx !== -1) {
        Object.assign(store[idx], update)
        return store[idx]
      }
      return null
    }

    try {
      const res1 = await PersonalAccessTokenManager.createToken(userId, { label: 'rot-label' })
      expect(res1).to.have.property('token')
      const res2 = await PersonalAccessTokenManager.createToken(userId, { label: 'rot-label', replace: true })
      expect(res2).to.have.property('token')
      // introspect original token - it should be inactive
      const info1 = await PersonalAccessTokenManager.introspect(res1.token)
      expect(info1 && info1.active).to.be.false
      // introspect new token - it should be active
      const info2 = await PersonalAccessTokenManager.introspect(res2.token)
      expect(info2 && info2.active).to.be.true
    } finally {
      // restore mongoose originals
      mongoosePkg.Model.prototype.save = origSave
      mongoosePkg.Model.find = origFind
      mongoosePkg.Model.findOneAndUpdate = origFindOneAndUpdate
    }
  }, 20000)
})
