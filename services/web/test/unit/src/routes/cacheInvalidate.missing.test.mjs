import { describe, it, beforeEach, expect, vi } from 'vitest'
import MockResponse from '../helpers/MockResponseVitest.mjs'

describe('cacheInvalidate route - missing fields', () => {
  let handler
  beforeEach(async () => {
    vi.resetModules()
    vi.mock('../../../../lib/pubsub.js', () => ({ publish: vi.fn(() => true) }))
    vi.mock('@overleaf/logger', () => ({ default: { err: vi.fn(), info: vi.fn() } }))
    handler = (await import('../../../../app/src/routes/cacheInvalidate.mjs')).default
  })

  it('returns 400 when channel or key missing', async () => {
    const req = { body: {} }
    const res = new MockResponse(vi)
    await handler(req, res)
    expect(res.statusCode).to.equal(400)
    expect(JSON.parse(res.body)).to.have.property('message')
  })
})