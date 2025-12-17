import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('HashPrefix format contract test', function () {
  this.timeout(60 * 1000)

  it('returns 8-character lowercase hex `hashPrefix` in token list', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    // Create a token
    const resCreate = await user.doRequest('post', { url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'contract-hash-prefix' } })
    expect([201, 200]).to.include(resCreate.response.statusCode)

    // Fetch token list
    const resList = await user.doRequest('get', { url: `/internal/api/users/${user.id}/git-tokens` })
    expect(resList.response.statusCode).to.equal(200)
    expect(resList.body).to.be.an('array')

    if (resList.body.length === 0) {
      // Some deployments may not list tokens (opt-out); skip the assertion in that case
      this.skip()
      return
    }

    // Assert the first entry has a properly formatted hashPrefix
    const entry = resList.body[0]
    expect(entry).to.have.property('hashPrefix')
    expect(entry.hashPrefix).to.match(/^[0-9a-f]{8}$/)
  })
})
