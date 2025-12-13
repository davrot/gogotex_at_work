import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../../helpers/MockResponse.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../app/src/Features/Token/TokenController.mjs')

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

    vi.doMock('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs', () => ({ default: ctx.PATM }))
    vi.doMock('@overleaf/logger', () => ({ info: () => {}, err: () => {} }))

    ctx.Controller = (await import(modulePath))
  })

  it('create returns 201 and token payload', async function (ctx) {
    ctx.req.params.userId = 'u1'
    ctx.req.body = { label: 'l' }
    await ctx.Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)
    const body = ctx.res.jsonBody
    expect(body).to.have.property('token')
    expect(ctx.PATM.createToken.called).to.equal(true)
  })

  it('list returns 200', async function (ctx) {
    await ctx.Controller.list(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
  })

  it('remove returns 204 when revoked', async function (ctx) {
    await ctx.Controller.remove(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(204)
    expect(ctx.PATM.revokeToken.called).to.equal(true)
  })

  it('introspect returns 200 and active true', async function (ctx) {
    ctx.req.body = { token: 'x' }
    await ctx.Controller.introspect(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    expect(ctx.res.jsonBody).to.have.property('active')
  })
})
