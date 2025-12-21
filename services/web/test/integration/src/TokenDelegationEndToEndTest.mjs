import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Token delegation end-to-end (webprofile)', function () {
  this.timeout(120 * 1000)

  before(function () {
    // request delegation for the test run; bootstrap will attempt to start shim
    process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'true'
  })
  after(function () {
    delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
  })

  it('creates, lists and revokes tokens using the webprofile shim', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create token via controller (should delegate to webprofile)
    const { response: createResp, body: createBody } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'e2e' }
    })
    expect([200, 201]).to.include(createResp.statusCode)
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
