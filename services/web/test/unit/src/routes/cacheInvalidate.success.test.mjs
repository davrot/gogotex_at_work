import { describe, it, beforeEach, expect, vi } from 'vitest'
import MockResponse from '../helpers/MockResponseVitest.mjs'

describe('cacheInvalidate route - success', () => {
  let handler
  beforeEach(async () => {
    vi.resetModules()
    vi.mock('../../../../lib/pubsub.js', () => ({ publish: vi.fn(() => true) }))
    vi.mock('@overleaf/logger', () => ({ default: { err: vi.fn(), info: vi.fn() } }))
    handler = (await import('../../../../app/src/routes/cacheInvalidate.mjs')).default
  })

  it('returns 204 when publish succeeds', async () => {
    const pub = await import('../../../../lib/pubsub.js')
    expect(typeof pub.publish).to.equal('function')
    expect(pub.publish('x', { key: 'y' })).to.equal(true)

    const req = { body: { channel: 'auth.cache.invalidate', key: 'token:1' } }
    const res = new MockResponse(vi)
    await handler(req, res)
    expect(res.statusCode).to.equal(204)
  })
})