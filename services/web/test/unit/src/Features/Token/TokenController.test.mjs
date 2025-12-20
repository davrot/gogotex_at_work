import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../../helpers/MockResponse.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../../app/src/Features/Token/TokenController.mjs')

describe('TokenController', function () {
  beforeEach(async function (ctx) {

    ctx.req = { params: { userId: 'u1', tokenId: 't1' }, body: {} }
    ctx.res = new MockResponse()
    // Mock PersonalAccessTokenManager
    ctx.PATM = {
      createToken: sinon.stub().resolves({ id: 'tid', token: 'plain-token', hashPrefix: 'deadbeef' }),
      listTokens: sinon.stub().resolves([]),
      revokeToken: sinon.stub().resolves(true),
      introspect: sinon.stub().resolves({ active: true, userId: 'u1', scopes: [] }),
    }

    // Ensure the actual modules are loaded and then patch/override their
    // exported members with our stubs so the controller uses them.
    vi.resetModules()
    vi.doMock('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs', () => ({ default: ctx.PATM }))

    // Provide a sinon-stubbed logger so tests can assert logging behavior
    ctx.logger = { info: sinon.stub(), err: sinon.stub() }
    vi.doMock('@overleaf/logger', () => ({ default: ctx.logger }))

    vi.doMock('@overleaf/metrics', () => ({ default: { Timer: function () { this.done = () => {} }, inc: () => {} } }))
    vi.doMock('../../../../../app/src/infrastructure/RateLimiter.js', () => ({ tokenIntrospectRateLimiter: { consume: async () => {} } }))

    ctx.Controller = (await import(modulePath))
  })

  it('create returns 201 and token payload', async function (ctx) {
    ctx.req.params.userId = 'u1'
    ctx.req.body = { label: 'l' }
    await ctx.Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)
    const body = ctx.res.body ? JSON.parse(ctx.res.body) : null
    expect(body).to.have.property('token')
    expect(ctx.PATM.createToken.called).to.equal(true)
  })

  it('create logs a token.created audit event', async function (ctx) {
    ctx.req.params.userId = 'u1'
    ctx.req.body = { label: 'l' }
    await ctx.Controller.create(ctx.req, ctx.res)
    expect(ctx.logger.info.calledOnce).to.equal(true)
    const logged = ctx.logger.info.getCall(0).args[0]
    expect(logged).to.include({ type: 'token.created', userId: 'u1', tokenId: 'tid', hashPrefix: 'deadbeef' })
  })

  it('list returns 200', async function (ctx) {
    await ctx.Controller.list(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
  })

  it('list returns 429 when rate-limited', async function (ctx) {
    // Make the rate limiter throw to simulate rate-limited origin
    const RateLimiterModule = await import('../../../../../app/src/infrastructure/RateLimiter.js')
    const sinon = await import('sinon')
    sinon.stub(RateLimiterModule.tokenIntrospectRateLimiter, 'consume').rejects(new Error('rate-limited'))

    await ctx.Controller.list(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(429)

    // restore stub
    try { RateLimiterModule.tokenIntrospectRateLimiter.consume.restore && RateLimiterModule.tokenIntrospectRateLimiter.consume.restore() } catch (e) {}
  })

  it('remove returns 204 when revoked', async function (ctx) {
    await ctx.Controller.remove(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(204)
    expect(ctx.PATM.revokeToken.called).to.equal(true)
  })

  it('introspect returns 200 and active true', async function (ctx) {
    ctx.req.body = { token: 'abcd' }
    await ctx.Controller.introspect(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    const introspectBody = ctx.res.body ? JSON.parse(ctx.res.body) : null
    expect(introspectBody).to.have.property('active')
  })

  it('does not log plaintext tokens to stdout or stderr', async function (ctx) {
    const PLAINTEXT = 'abcdef0123456789'
    ctx.req.body = { token: PLAINTEXT }

    // stub console methods
    const logStub = sinon.stub(console, 'log')
    const debugStub = sinon.stub(console, 'debug')

    try {
      await ctx.Controller.introspect(ctx.req, ctx.res)

      // console.log must not be used to print the full token
      expect(logStub.called).to.equal(false)

      // console.debug may be used for masked tokens only; ensure it never contains the full plaintext
      if (debugStub.called) {
        for (const call of debugStub.getCalls()) {
          const argsJoined = call.args.join(' ')
          expect(argsJoined.includes(PLAINTEXT)).to.equal(false)
        }
      }
    } finally {
      logStub.restore()
      debugStub.restore()
    }
  })

  it('create with expiresAt returns created token and introspect shows expired', async function (ctx) {
    // create a token with expiresAt in the past
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    ctx.req.body = { label: 'exp', expiresAt: past }
    ctx.PATM.createToken.resolves({ id: 'tid2', token: 'plain-exp', hashPrefix: 'deadbeef', expiresAt: past })
    await ctx.Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)

    // introspect expired token should be inactive
    ctx.PATM.introspect.resolves({ active: false })
    ctx.req.body = { token: 'abcdef01' }
    await ctx.Controller.introspect(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    const expiredBody = ctx.res.body ? JSON.parse(ctx.res.body) : null
    expect(expiredBody.active).to.be.false
  })

  it('list returns tokens and does not include plaintext', async function (ctx) {
    // list returns what manager returns; ensure it includes expected fields
    ctx.PATM.listTokens.resolves([{ id: 't1', label: 'l1', active: true, hashPrefix: 'abcd' }])
    await ctx.Controller.list(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    const listBody = ctx.res.body ? JSON.parse(ctx.res.body) : null
    expect(listBody[0]).to.have.property('id')
    expect(listBody[0]).to.not.have.property('token')
  })

  it('remove returns 404 when token not found', async function (ctx) {
    // simulate revoke returning false
    ctx.PATM.revokeToken.resolves(false)
    await ctx.Controller.remove(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(404)
    expect(ctx.PATM.revokeToken.called).to.equal(true)
  })
})
