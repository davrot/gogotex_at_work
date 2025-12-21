import { describe, it, beforeEach, vi } from 'vitest'

// Lightweight instrumentation test to verify module mocking
let mockMongoose = { models: {}, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }
vi.mock('../../../../../app/src/infrastructure/Mongoose.js', () => mockMongoose)

vi.mock('../../../../../app/src/models/UserSSHKey.js', () => {
  class MockUserSSHKey {
    constructor(doc) { this._id = 'mock-k'; this.userId = doc && doc.userId ? doc.userId : 'u1'; this.publicKey = doc && doc.publicKey }
    async save() { return this }
    static find = vi.fn().mockResolvedValue([])
    static findOneAndDelete = vi.fn()
    static findOneAndUpdate = vi.fn((filter, update, opts) => ({ exec: () => Promise.resolve({ value: { _id: 'mock-k', userId: update && update.$setOnInsert && update.$setOnInsert.userId ? update.$setOnInsert.userId : 'u1', fingerprint: filter && filter.fingerprint ? filter.fingerprint : 'SHA256:mock', createdAt: new Date() }, lastErrorObject: {} }) }))
    static findOne = vi.fn((q) => ({ lean: () => ({ exec: () => Promise.resolve({ _id: 'mock-k', userId: 'u1', fingerprint: q && q.fingerprint ? q.fingerprint : 'SHA256:mock' }) }) }))
    static collection = { insertOne: vi.fn(async (doc) => ({ insertedId: 'mock-k' })), aggregate: () => ({ toArray: async () => [] }) }
  }
  mockMongoose.models.UserSSHKey = MockUserSSHKey
  mockMongoose.models.User = { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) }
  return { default: MockUserSSHKey, UserSSHKey: MockUserSSHKey }
})

vi.mock('mongoose', () => ({ models: {}, model: () => {}, Schema: {} }))
vi.mock('@overleaf/logger', () => ({ default: { debug: vi.fn(), info: vi.fn(), err: vi.fn(), warn: vi.fn() } }))

describe('Import instrumentation', () => {
  it('should import Controller and show model is mocked', async () => {
    const Controller = await import('../../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    // Sanity checks: ensure controller is imported and mocks are applied
    console.error('Controller loaded, Model mocked? ', (Controller && Controller.create) ? 'YES' : 'NO')
    const modelModule = await import('../../../../../../app/src/models/UserSSHKey.js')
    console.error('modelModule keys:', Object.keys(modelModule))
    console.error('Mock mongoose.models keys', Object.keys(mockMongoose.models))
    const mongoose = await import('mongoose')
    console.error('mongoose.models keys', Object.keys(mongoose.models || {}))
    // Basic assertions (no long-running create invocation to avoid side-effects)
    if (!Controller || !Controller.create) throw new Error('Controller not loaded or create not present')
  })
})
