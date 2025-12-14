import { describe, it, beforeEach, expect, vi } from 'vitest'
import MockResponse from '../helpers/MockResponseVitest.mjs'

describe('cacheInvalidate route - publish false', () => {
  let handler
  beforeEach(async () => {
    vi.resetModules()
    vi.mock('../../../../lib/pubsub.js', () => ({ publish: vi.fn(() => false) }))
    vi.mock('@overleaf/logger', () => ({ default: { err: vi.fn(), info: vi.fn() } }))
    handler = (await import('../../../../app/src/routes/cacheInvalidate.mjs')).default
  })

  it('returns 500 when publish returns false', async () => {
    const req = { body: { channel: 'auth.cache.invalidate', key: 'token:1' } }
    const res = new MockResponse(vi)
    await handler(req, res)
    expect(res.statusCode).to.equal(500)
  })
})