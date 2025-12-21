import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest'

// Mock logger and metrics
vi.mock('@overleaf/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), err: vi.fn(), debug: vi.fn() } }))
vi.mock('@overleaf/metrics', () => ({ default: { increment: vi.fn() } }))

describe('SSH upsert logging and metrics', () => {
  let Controller
  let logger
  let metrics

  beforeEach(async () => {
    // Reset modules and imports
    vi.resetModules()
    Controller = await import(new URL('../../../../../app/src/Features/User/UserSSHKeysController.mjs', import.meta.url).toString())
    const loggerModule = await import('@overleaf/logger')
    logger = loggerModule.default
    const metricsModule = await import('@overleaf/metrics')
    metrics = metricsModule.default
  })

  afterEach(() => {
    try { Controller.__resetUserSSHKeyForTest && Controller.__resetUserSSHKeyForTest() } catch (e) {}
  })

  it('calls logger.info and emits metrics on successful upsert', async () => {
    const mockModel = {
      findOneAndUpdate: (filter, update, opts) => ({ exec: () => Promise.resolve({ value: { _id: 'k1', userId: 'u1', fingerprint: filter && filter.fingerprint ? filter.fingerprint : 'SHA256:testfp', createdAt: new Date() }, lastErrorObject: {} }) }),
      findOne: (q) => ({ lean: () => ({ exec: () => Promise.resolve({ _id: 'k1', userId: 'u1', fingerprint: q && q.fingerprint }) }) }),
      collection: { insertOne: async (doc) => ({ insertedId: 'k1' }) }
    }

    Controller.__setUserSSHKeyForTest && Controller.__setUserSSHKeyForTest(mockModel)

    const req = { params: { userId: 'u1' }, body: { key_name: 'k', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplefixture' }, session: {}, get: () => undefined, headers: {} }
    const res = { statusCode: null, body: null, status(s) { this.statusCode = s; return { json: (b) => { this.body = b } } }, sendStatus(s) { this.statusCode = s } }

    await Controller.create(req, res)

    expect(metrics.increment).toHaveBeenCalled()
    // assert we emitted overall counter and success counter at least
    expect(metrics.increment.mock.calls.some(c => c[0] === 'ssh_upsert_total')).toBe(true)
    expect(metrics.increment.mock.calls.some(c => c[0] === 'ssh_upsert_success')).toBe(true)

    expect(logger.info).toHaveBeenCalled()
    expect(logger.info.mock.calls.some(c => c[0] && c[0].type === 'sshkey.added')).toBe(true)
  })
})