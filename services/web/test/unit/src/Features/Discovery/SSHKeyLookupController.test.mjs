import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../../../../test/unit/src/helpers/MockResponse.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../../app/src/Features/Discovery/SSHKeyLookupController.mjs')

describe('SSHKeyLookupController', function () {
  beforeEach(async function (ctx) {
    ctx.req = { params: { fingerprint: 'SHA256:abcdef' } }
    ctx.res = new MockResponse()
    ctx.UserSSHKey = { findOne: sinon.stub() }
    vi.doMock('../../../../../app/src/models/UserSSHKey.js', () => ({ UserSSHKey: ctx.UserSSHKey }))
    ctx.Controller = (await import(modulePath))
  })

  it('lookup returns 200 when found', async function (ctx) {
    ctx.UserSSHKey.findOne.resolves({ userId: 'u1' })
    await ctx.Controller.lookup(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    expect(ctx.res.jsonBody).to.have.property('userId')
    expect(ctx.UserSSHKey.findOne.calledWith({ fingerprint: 'SHA256:abcdef' })).to.equal(true)
  })

  it('lookup returns 404 when not found', async function (ctx) {
    ctx.UserSSHKey.findOne.resolves(null)
    await ctx.Controller.lookup(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(404)
  })
})
