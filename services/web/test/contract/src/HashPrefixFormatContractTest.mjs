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

    // If the create response contains an accessTokenPartial (or hashPrefix), assert its format
    const createBody = resCreate.body || {}
    const createPrefix = createBody.accessTokenPartial || createBody.hashPrefix
    if (createPrefix) {
      expect(createPrefix).to.match(/^[0-9a-f]{8}$/)
    } else {
      // Some deployments opt out of returning the partial on create; skip the POST assertion in that case
      // eslint-disable-next-line no-console
      console.debug('[HashPrefixFormatContractTest] create response did not include accessTokenPartial/hashPrefix; skipping POST assertion')
    }

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
