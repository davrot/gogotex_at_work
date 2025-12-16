import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../../helpers/MockResponse.js'
const modulePath = new URL('../../../../../app/src/Features/User/UserSSHKeysController.mjs', import.meta.url).toString()

describe('UserSSHKeysController', function () {
  beforeEach(async function (ctx) {
    vi.resetModules()
    ctx.req = { params: { userId: 'u1' }, body: {}, headers: {} }
    ctx.res = new MockResponse()
    // Mock a constructor-like UserSSHKey model
    function MockUserSSHKey(doc) {
      this._id = 'mock-k'
      this.keyName = doc.keyName
      this.publicKey = doc.publicKey
      this.fingerprint = 'SHA256:MOCK'
      this.createdAt = new Date().toISOString()
      this.updatedAt = new Date().toISOString()
    }
    MockUserSSHKey.prototype.save = sinon.stub().resolves()
    MockUserSSHKey.find = sinon.stub()
    MockUserSSHKey.findOneAndDelete = sinon.stub()
    MockUserSSHKey.findOne = sinon.stub()
    ctx.UserSSHKey = MockUserSSHKey
    // Use absolute file URLs for mocks to match controller imports exactly
    // Mock both src and non-src paths to be robust against import resolution
    vi.doMock(new URL('../../../../../app/src/models/UserSSHKey.js', import.meta.url).toString(), () => ({ UserSSHKey: ctx.UserSSHKey }))
    vi.doMock(new URL('../../../../../app/models/UserSSHKey.js', import.meta.url).toString(), () => ({ UserSSHKey: ctx.UserSSHKey }))
    vi.doMock(new URL('../../../../../app/src/models/User.js', import.meta.url).toString(), () => ({ User: { findById: sinon.stub().resolves({ email: 'test@example.com', first_name: 'fn', last_name: 'ln' }) } }))
    vi.doMock(new URL('../../../../../app/models/User.js', import.meta.url).toString(), () => ({ User: { findById: sinon.stub().resolves({ email: 'test@example.com', first_name: 'fn', last_name: 'ln' }) } }))

    vi.doMock('@overleaf/logger', () => ({ default: { info: () => {}, err: () => {}, warn: () => {}, debug: () => {} } }))
    // Default SessionManager mock returns undefined unless overridden by tests
    vi.doMock('../../../../../app/src/Features/Authentication/SessionManager.mjs', () => ({ default: { getLoggedInUserId: () => undefined, getSessionUser: () => undefined } }))

    ctx.Controller = (await import(modulePath))
  })

  it('create returns 201 with fingerprint and caches', async function (ctx) {
    ctx.req.body = { key_name: 'test', public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCy' }
    ctx.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [] }) })
    await ctx.Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)
    const body = JSON.parse(ctx.res.body)
    expect(body).to.have.property('fingerprint')
  })

  it('create uses session user id when params.userId missing', async function (ctx) {
    // override SessionManager mock for this test (absolute URL)
    vi.resetModules()
    vi.doMock(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString(), () => ({ default: { getLoggedInUserId: () => 'session-u' } }), { virtual: false })
    // re-import controller to pick up overridden mock
    const Controller = (await import(modulePath))

    ctx.req = { params: {}, body: { key_name: 's', public_key: 'ssh-ed25519 AAAAB3Nza' }, headers: {} }
    ctx.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [] }) })

    await Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)
    const body = JSON.parse(ctx.res.body)
    expect(body).to.have.property('userId', 'session-u')
  })

  it('create returns 403 when trying to create for another user and not admin', async function (ctx) {
    // session user id is 'session-u', but params.userId is 'other'
    vi.resetModules()
    vi.doMock(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString(), () => ({ default: { getLoggedInUserId: () => 'session-u', getSessionUser: () => ({ _id: 'session-u', isAdmin: false }) } }), { virtual: false })
    // ensure admin access check returns false
    vi.doMock(new URL('../../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs', import.meta.url).toString(), () => ({ default: { hasAdminAccess: () => false } }), { virtual: false })
    // re-import controller to pick up overridden mock
    const Controller = (await import(modulePath))

    ctx.req = { params: { userId: 'other' }, body: { key_name: 's', public_key: 'ssh-ed25519 AAAAB3Nza' }, headers: {} }
    ctx.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [] }) })
    // debug: confirm session id and admin helper at runtime
    const Sess = await import(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString())
    const Admin = await import(new URL('../../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs', import.meta.url).toString())
    console.error('DEBUG before create sessId=', Sess.default.getLoggedInUserId(), 'hasAdmin=', Admin.default.hasAdminAccess(Sess.default.getSessionUser()))

    await Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(403)
  })

  it('create allowed when trying to create for another user if admin', async function (ctx) {
    vi.resetModules()
    vi.doMock(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString(), () => ({ default: { getLoggedInUserId: () => 'session-u', getSessionUser: () => ({ _id: 'session-u', isAdmin: true }) } }), { virtual: false })
    vi.doMock(new URL('../../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs', import.meta.url).toString(), () => ({ default: { hasAdminAccess: () => true } }), { virtual: false })
    const Controller = (await import(modulePath))

    ctx.req = { params: { userId: 'other' }, body: { key_name: 's', public_key: 'ssh-ed25519 AAAAB3Nza' }, headers: {} }
    ctx.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [] }) })

    await Controller.create(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(201)
  })

  it('remove invalidates cache and returns 204', async function (ctx) {
    const fakeDoc = { _id: 'k1', fingerprint: 'SHA256:AAAA', userId: 'u1' }
    ctx.UserSSHKey.findOneAndDelete.resolves(fakeDoc)
    ctx.req.params.keyId = 'k1'
    await ctx.Controller.remove(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(204)
  })

  it('list uses session user id when params.userId missing', async function (ctx) {
    vi.resetModules()
    vi.doMock(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString(), () => ({ default: { getLoggedInUserId: () => 'session-l' } }), { virtual: false })
    const Controller = (await import(modulePath))
    ctx.req = { params: {}, headers: {} }
    ctx.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [{ _id: 'k2', keyName: 'k', publicKey: 'ssh-rsa AAA', fingerprint: 'fp', createdAt: '2025-01-01', userId: 'session-l' } ] }) })
    await Controller.list(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    const body = JSON.parse(ctx.res.body)
    expect(Array.isArray(body)).to.be.true
    expect(body[0]).to.have.property('userId', 'session-l')
  })

  it('remove uses session user id when params.userId missing', async function (ctx) {
    vi.resetModules()
    vi.doMock(new URL('../../../../../app/src/Features/Authentication/SessionManager.mjs', import.meta.url).toString(), () => ({ default: { getLoggedInUserId: () => 'session-r' } }), { virtual: false })
    const Controller = (await import(modulePath))
    const fakeDoc = { _id: 'k3', fingerprint: 'SHA256:BBBB', userId: 'session-r' }
    ctx.UserSSHKey.findOneAndDelete.resolves(fakeDoc)
    ctx.req = { params: { keyId: 'k3' }, headers: {} }
    await Controller.remove(ctx.req, ctx.res)
    expect(ctx.res.statusCode).to.equal(204)
  })
})
