import { beforeEach, describe, expect, it, vi } from 'vitest'
import MockResponse from '../../helpers/MockResponse.js'

const modulePath = new URL('../../../../../app/src/Features/Admin/TokenReissueController.mjs', import.meta.url).toString()

describe('TokenReissueController', function () {
  beforeEach(async function (ctx) {
    vi.resetModules()
    ctx.res = new MockResponse()
    ctx.db = { personal_access_token_reissues: { findOne: vi.fn() } }
    const dbModulePath = new URL('../../../../app/src/infrastructure/mongodb.js', modulePath).toString()
    vi.doMock(dbModulePath, () => ({ db: ctx.db }))
  })

  it('returns 404 when not found', async function (ctx) {
    ctx.db.personal_access_token_reissues.findOne.mockResolvedValue(undefined)
    const Controller = (await import(modulePath))
    const req = { params: { id: 'notfound' } }
    await Controller.get(req, ctx.res)
    expect(ctx.res.statusCode).to.equal(404)
  })

  it('returns masked when encryption not configured', async function (ctx) {
    const fakeDoc = { _id: 'r1', userId: 'u1', newTokenId: 'nt1', encryptedSecret: 'abc', delivered: false }
    ctx.db.personal_access_token_reissues.findOne.mockResolvedValue(fakeDoc)
    const Controller = (await import(modulePath))
    const req = { params: { id: 'r1' } }
    await Controller.get(req, ctx.res)
    expect(ctx.res.statusCode).to.equal(200)
    const body = JSON.parse(ctx.res.body)
    expect(body).to.have.property('note', 'encryption not configured')
  })
})
