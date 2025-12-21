import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'
import sinon from 'sinon'

describe('Token delegation integration (webprofile)', function () {
  this.timeout(60 * 1000)

  beforeEach(() => {
    // enable delegation for this test process
    process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'true'
    sinon.restore()
  })
  afterEach(() => {
    delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
    sinon.restore()
  })

  it('creates, lists and revokes tokens via webprofile delegation', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // stub global fetch that WebProfileClient uses
    let createdId = 'd1'
    sinon.stub(global, 'fetch').callsFake(async (url, opts) => {
      if (opts && opts.method === 'POST') {
        return { status: 201, async json () { return { token: 'delegated-t', id: createdId, accessTokenPartial: 'hp' } } }
      }
      if (opts && opts.method === 'GET') {
        return { status: 200, async json () { return [{ id: createdId, label: 'integration', hashPrefix: 'hp', active: true }] } }
      }
      if (opts && opts.method === 'DELETE') {
        return { status: 204 }
      }
      return { status: 500 }
    })

    // create token via controller (should delegate)
    const { response: createResp, body: createBody } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'integration' }
    })
    expect([200, 201]).to.include(createResp.statusCode)
    expect(createBody.token || createBody.plaintext).to.be.a('string')
    const tokenId = createBody.id || createBody.tokenId
    expect(tokenId).to.be.a('string')

    // list tokens
    const { response: listResp, body: listBody } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(listResp.statusCode).to.equal(200)
    expect(Array.isArray(listBody)).to.equal(true)
    const listed = listBody.find(t => t.id === tokenId)
    expect(listed).to.not.equal(undefined)

    // delete token
    const del = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${tokenId}` })
    expect([204,200]).to.include(del.response.statusCode)
  })
})
