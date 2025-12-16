import { describe, it, beforeEach, expect, vi } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../../app/src/Features/Discovery/DiscoveryRouter.mjs')

describe('DiscoveryRouter', function () {
  beforeEach(async function (ctx) {
    ctx.webRouter = {}
    ctx.privateApiRouter = { get: sinon.stub() }
    // stub modules used by DiscoveryRouter
    ctx.requirePrivateApiAuth = sinon.stub().returns('requirePrivate')
    ctx.rateLimit = sinon.stub().returns('rateLimiter')
    ctx.lookup = () => 'lookup'
    vi.doMock('../../../../../app/src/Features/Authentication/AuthenticationController.mjs', () => ({ default: { requirePrivateApiAuth: ctx.requirePrivateApiAuth } }))
    vi.doMock('../../../../../app/src/Features/Security/RateLimiterMiddleware.mjs', () => ({ rateLimit: ctx.rateLimit }))
    vi.doMock('../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs', () => ({ lookup: ctx.lookup }))
    ctx.Router = (await import(modulePath)).default
  })

  it('applies private auth + rate limit + lookup on fingerprint route', async function (ctx) {
    ctx.Router.apply(ctx.webRouter, ctx.privateApiRouter)
    expect(ctx.privateApiRouter.get.calledOnce).to.equal(true)
    const args = ctx.privateApiRouter.get.firstCall.args
    expect(args[0]).to.equal('/internal/api/ssh-keys/:fingerprint')
    // middleware at args 1..n-1 should include the stubs
    const middlewares = args.slice(1, -1)
    expect(middlewares).to.include('requirePrivate')
    expect(middlewares).to.include('rateLimiter')
    // last handler is the lookup function
    expect(args[args.length - 1]).to.equal(ctx.lookup)
  })
})
