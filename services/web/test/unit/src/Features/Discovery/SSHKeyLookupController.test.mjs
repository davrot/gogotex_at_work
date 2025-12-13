import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../../helpers/MockResponse.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')

describe('SSHKeyLookupController', function () {
  beforeEach(async function (ctx) {
    vi.resetModules()
    ctx.req = { params: { fingerprint: 'SHA256:abcdef' } }
    ctx.res = new MockResponse()
    ctx.UserSSHKey = { findOne: sinon.stub() }
    vi.doMock('../../../../../app/src/models/UserSSHKey.js', () => ({ UserSSHKey: ctx.UserSSHKey }))
    ctx.Controller = (await import(modulePath))
  })

  it('lookup returns 200 when found', async function (ctx) {
    ctx.UserSSHKey.findOne.returns({ lean: () => ({ exec: async () => ({ userId: 'u1' }) }) })
    await ctx.Controller.lookup(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    expect(JSON.parse(ctx.res.body)).to.have.property('userId')
    expect(ctx.UserSSHKey.findOne.calledWith({ fingerprint: 'SHA256:abcdef' })).to.equal(true)
  })

  it('lookup returns 404 when not found', async function (ctx) {
    ctx.UserSSHKey.findOne.returns({ lean: () => ({ exec: async () => null }) })
    const chain = ctx.UserSSHKey.findOne();
    // debug: check chain exec result
    // eslint-disable-next-line no-console
    // console.log('DEBUG: findOne chain exec returns', await chain.lean().exec())
    await ctx.Controller.lookup(ctx.req, ctx.res)
    // debug: print response for investigation
    // eslint-disable-next-line no-console
    // console.log('DEBUG: resp', ctx.res.statusCode, ctx.res.body)
    expect(ctx.res.statusCode).to.equal(404)
  })

  it('lookup returns 400 when fingerprint missing', async function (ctx) {
    ctx.req.params.fingerprint = ''
    await ctx.Controller.lookup(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(400)
  })

  it('lookup returns 400 when fingerprint malformed', async function (ctx) {
    ctx.req.params.fingerprint = 'abcdef'
    await ctx.Controller.lookup(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(400)
  })
})
