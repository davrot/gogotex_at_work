import { describe, it, beforeEach, expect, vi } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../../app/src/Features/Discovery/DiscoveryRouter.mjs')

describe('SSHKey lookup auth enforcement (unit)', function () {
  let ctx
  beforeEach(async function () {
    ctx = {}
    ctx.webRouter = {}
    ctx.privateApiRouter = { get: sinon.stub() }
    ctx.requirePrivateApiAuth = sinon.stub().returns('requirePrivate')
    ctx.rateLimit = sinon.stub().returns('rateLimiter')
    ctx.lookup = () => 'lookup'

    vi.doMock('../../../../../app/src/Features/Authentication/AuthenticationController.mjs', () => ({ default: { requirePrivateApiAuth: ctx.requirePrivateApiAuth } }))
    vi.doMock('../../../../../app/src/Features/Security/RateLimiterMiddleware.mjs', () => ({ default: { rateLimit: ctx.rateLimit } }))
    vi.doMock('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs', () => ({ default: { lookup: ctx.lookup } }))

    ctx.Router = (await import(modulePath)).default
  })

  it('ensures private auth middleware is applied to fingerprint route', async function () {
    ctx.Router.apply(ctx.webRouter, ctx.privateApiRouter)
    expect(ctx.privateApiRouter.get.calledOnce).to.equal(true)
    const args = ctx.privateApiRouter.get.firstCall.args
    // middleware at args 1..n-1 should include the requirePrivate stub
    const middlewares = args.slice(1, -1)
    expect(middlewares).to.include('requirePrivate')
  })
})
