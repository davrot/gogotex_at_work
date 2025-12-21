import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Token create/list/remove integration tests', function () {
  this.timeout(60 * 1000)

  it('creates a token, lists it and deletes it', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // create token
    const { response: createResp, body: createBody } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'integration-token' },
    })
    expect([200, 201]).to.include(createResp.statusCode)
    // API should return plaintext token once
    const plaintext = createBody && (createBody.token || createBody.plaintext || createBody.token)
    expect(plaintext).to.be.a('string')
    const tokenId = createBody && (createBody.id || createBody.tokenId)
    expect(tokenId).to.be.a('string')

    // list tokens (as logged in user)
    const { response: listResp, body: listBody } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(listResp.statusCode).to.equal(200)
    expect(Array.isArray(listBody)).to.equal(true)
    const listed = listBody.find(t => t.id === tokenId)
    expect(listed).to.not.equal(undefined)
    expect(listed).to.have.property('hashPrefix')

    // delete token
    const del = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${tokenId}` })
    // deletion returns 204 when successful
    expect([204, 200]).to.include(del.response.statusCode)

    // after delete, list should not include active token
    const { response: list2Resp, body: list2Body } = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(list2Resp.statusCode).to.equal(200)
    const still = list2Body.find(t => t.id === tokenId)
    // token may be removed or marked inactive depending on implementation; ensure it's not active
    if (still) {
      expect(still.active === false).to.equal(true)
    }
  })
})
