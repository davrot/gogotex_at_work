import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

describe('WebProfile delegation for SSH (create/list/remove)', () => {
  let origEnv
  beforeEach(async () => {
    origEnv = process.env.AUTH_SSH_USE_WEBPROFILE_API
    process.env.AUTH_SSH_USE_WEBPROFILE_API = 'true'
    vi.resetModules()
    // ensure model mocks used by other tests remain available
    // Import the controller fresh in each test
  })
  afterEach(() => {
    if (origEnv === undefined) delete process.env.AUTH_SSH_USE_WEBPROFILE_API
    else process.env.AUTH_SSH_USE_WEBPROFILE_API = origEnv
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('delegates create to WebProfileClient and returns mapped response', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({
      status: 201,
      async json() { return { id: 'r1', fingerprint: 'SHA256:ABC', public_key: JSON.parse(opts.body).public_key, key_name: JSON.parse(opts.body).key_name, createdAt: '2025-01-01T00:00:00Z' } }
    }))
    const Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    const req = { params: { userId: '000000000000000000000001' }, body: { key_name: 'x', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample' }, session: {}, headers: { 'x-dev-user-id': '000000000000000000000001' } }
    const res = new MockResponse()
    await Controller.create(req, res)
    expect(res.statusCode).to.equal(201)
    const body = JSON.parse(res.body)
    expect(body.fingerprint).to.equal('SHA256:ABC')
    expect(body.id).to.equal('r1')
  })

  it('delegates list to WebProfileClient and returns mapped list', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({
      status: 200,
      async json() { return [{ id: 'r2', fingerprint: 'SHA256:LIST', public_key: 'ssh-ed25519 AAAA', key_name: 'k' }] }
    }))
    const Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    const req = { params: { userId: '000000000000000000000001' }, session: {}, headers: { 'x-dev-user-id': '000000000000000000000001' } }
    const res = new MockResponse()
    await Controller.list(req, res)
    expect(res.statusCode).to.equal(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).to.equal(true)
    expect(body[0].fingerprint).to.equal('SHA256:LIST')
  })

  it('delegates remove to WebProfileClient and returns 204', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 204 }))
    const Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    const req = { params: { userId: '000000000000000000000001', keyId: 'r3' }, session: {}, headers: { 'x-dev-user-id': '000000000000000000000001' } }
    const res = new MockResponse()
    await Controller.remove(req, res)
    expect(res.statusCode).to.equal(204)
  })

  it('falls back to DB when WebProfileClient returns null for create', async () => {
    // Simulate delegate failure (e.g., 302 or non-201) -> client returns null
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 302 }))
    // Mock DB behavior to simulate an upsert fallback
    const Controller = await import('../../../../../app/src/Features/User/UserSSHKeysController.mjs')
    const MockUserSSHKey = {
      findOneAndUpdate: vi.fn().mockReturnValue({ exec: async () => ({ value: { _id: 'mk', fingerprint: 'SHA256:FOO', userId: '000000000000000000000002', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), keyName: 'db' } }) }),
      findOne: vi.fn().mockReturnValue({ lean: () => ({ exec: async () => null }) }),
      findOneAndDelete: vi.fn(),
    }
    if (Controller && typeof Controller.__setUserSSHKeyForTest === 'function') Controller.__setUserSSHKeyForTest(MockUserSSHKey)
    const req = { params: { userId: '000000000000000000000002' }, body: { key_name: 'db', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample2' }, session: {}, headers: { 'x-dev-user-id': '000000000000000000000002' } }
    const res = new MockResponse()
    await Controller.create(req, res)
    expect([200, 201]).to.contain(res.statusCode)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('fingerprint')
    // cleanup mock
    try { if (Controller && typeof Controller.__resetUserSSHKeyForTest === 'function') Controller.__resetUserSSHKeyForTest() } catch (e) {}
  })
})
