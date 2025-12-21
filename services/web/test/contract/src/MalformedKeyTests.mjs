import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Malformed SSH public_key validation (contract test)', function () {
  this.timeout(60 * 1000)

  it('returns 400 for malformed public_key format', async function () {
    const user = new UserHelper()
    // Debug: inspect user helper prototype
    // eslint-disable-next-line no-console
    console.debug('[MalformedKeyTests] user proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)), 'has.register=', typeof user.register)
    await user.register()
    await user.login()

    const badKey = 'not-a-valid-ssh-key'
    const res = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/ssh-keys`,
      json: { key_name: 'bad', public_key: badKey },
    })
    expect(res.response.statusCode).to.equal(400)
    expect(res.body).to.have.property('message')
  })
})
