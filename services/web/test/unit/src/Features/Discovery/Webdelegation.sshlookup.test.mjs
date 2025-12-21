import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

describe('WebProfile delegation for SSH fingerprint lookup', () => {
  let origEnv
  beforeEach(() => {
    origEnv = process.env.AUTH_SSH_USE_WEBPROFILE_API
    process.env.AUTH_SSH_USE_WEBPROFILE_API = 'true'
    vi.resetModules()
  })
  afterEach(() => {
    if (origEnv === undefined) delete process.env.AUTH_SSH_USE_WEBPROFILE_API
    else process.env.AUTH_SSH_USE_WEBPROFILE_API = origEnv
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('delegates fingerprint lookup to WebProfileClient and returns 200', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 200, async json() { return { userId: 'u123' } } }))
    const Controller = await import('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')
    const req = { params: { fingerprint: 'SHA256:ABCDEFG' }, headers: {} }
    const res = new MockResponse()
    await Controller.lookup(req, res)
    expect(res.statusCode).to.equal(200)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('userId', 'u123')
  })

  it('falls back to DB when delegation returns null', async () => {
    // delegation returns explicit null (404 upstream)
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 404 }))
    const Controller = await import('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')
    // stub DB to return a value so fallback returns 200
    const MockUserSSHKey = { findOne: vi.fn().mockReturnValue({ lean: () => ({ exec: async () => ({ _id: 'k1', fingerprint: 'SHA256:ABCDEFG', userId: 'session-l' }) }) }) }
    if (Controller && typeof Controller.__setUserSSHKeyForTest === 'function') Controller.__setUserSSHKeyForTest(MockUserSSHKey)
    const req = { params: { fingerprint: 'SHA256:ABCDEFG' }, headers: {} }
    const res = new MockResponse()
    await Controller.lookup(req, res)
    expect(res.statusCode).to.equal(200)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('userId')
    try { if (Controller && typeof Controller.__resetUserSSHKeyForTest === 'function') Controller.__resetUserSSHKeyForTest() } catch (e) {}
  })
})
