import { describe, it, beforeEach, vi } from 'vitest'

// Lightweight instrumentation test to verify module mocking
let mockMongoose = { models: {}, set: vi.fn(), connect: vi.fn().mockResolvedValue(null), connection: { on: vi.fn(), client: {} }, plugin: vi.fn(), Promise: Promise }
vi.mock('../../../../../app/src/infrastructure/Mongoose.js', () => mockMongoose)

vi.mock('../../../../../app/src/models/UserSSHKey.js', () => {
  class MockUserSSHKey {
    constructor(doc) { this._id = 'mock-k'; this.userId = doc.userId }
    async save() { return this }
    static find = vi.fn()
    static findOneAndDelete = vi.fn()
  }
  mockMongoose.models.UserSSHKey = MockUserSSHKey
  mockMongoose.models.User = { findById: vi.fn().mockResolvedValue({ email: 'test@example.com' }) }
  return { default: MockUserSSHKey, UserSSHKey: MockUserSSHKey }
})

vi.mock('@overleaf/logger', () => ({ default: { debug: vi.fn(), info: vi.fn(), err: vi.fn(), warn: vi.fn() } }))

describe('Import instrumentation', () => {
  it('should import Controller and show model is mocked', async () => {
    const Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    console.error('Controller loaded, Model mocked? ', (Controller && Controller.create) ? 'YES' : 'NO')
    const modelModule = await import('../../../../../app/src/models/UserSSHKey.js')
    console.error('modelModule keys:', Object.keys(modelModule))
    console.error('Mock mongoose.models keys', Object.keys(mockMongoose.models))
    const mongoose = await import('mongoose')
    console.error('mongoose.models keys', Object.keys(mongoose.models || {}))
    // Try invoking create to see if it uses mock
    const res = { statusCode: null, body: null, status: (s) => { res.statusCode = s; return { json: (b) => { res.body = JSON.stringify(b) } } }, sendStatus: (s) => { res.statusCode = s } }
    const req = { params: { userId: '000000000000000000000001' }, body: { key_name: 'test', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample fixture' }, session: {} }
    try {
      await Controller.create(req, res)
      console.error('Controller create status', res.statusCode)
    } catch (e) {
      console.error('Controller create threw', e && e.stack ? e.stack : e)
    }
  })
})
