import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

describe('WebProfile delegation for SSH fingerprint lookup', () => {
  let origEnv
  beforeEach(() => {
    origEnv = process.env.AUTH_SSH_USE_WEBPROFILE_API
    process.env.AUTH_SSH_USE_WEBPROFILE_API = 'true'
    // stub rate limiter to avoid external Redis dependency
    vi.mock('../../../../../app/src/infrastructure/RateLimiter.js', () => ({ sshFingerprintLookupRateLimiter: { consume: vi.fn().mockResolvedValue(true) } }))
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
    const req = { params: { fingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, headers: {} }
    const res = new MockResponse()
    await Controller.lookup(req, res)
    expect(res.statusCode).to.equal(200)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('userId', 'u123')
  })

  it('returns 404 when delegation reports missing key', async () => {
    // delegation returns explicit null (404 upstream) -> Node should return 404 (delegation authoritative)
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 404 }))
    const Controller = await import('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')
    const req1 = { params: { fingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, headers: {} }
    const res1 = new MockResponse()
    await Controller.lookup(req1, res1)
    expect(res1.statusCode).to.equal(404)
  })

  it('falls back to DB when delegation errors', async () => {
    // delegation throws -> fall back to DB and honor DB result
    vi.stubGlobal('fetch', async (url, opts) => { throw new Error('network failure') })
    const model = await import('../../../../../app/src/models/UserSSHKey.js')
    model.UserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => ({ _id: 'k1', fingerprint: 'SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', userId: 'session-l' }) }) })
    const Controller = await import('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')
    const req2 = { params: { fingerprint: 'SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }, headers: {} }
    const res2 = new MockResponse()
    await Controller.lookup(req2, res2)
    expect(res2.statusCode).to.equal(200)
    const body = JSON.parse(res2.body)
    expect(body).to.have.property('userId')
    try { if (Controller && typeof Controller.__resetUserSSHKeyForTest === 'function') Controller.__resetUserSSHKeyForTest() } catch (e) {}
  })
})
