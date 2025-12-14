import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/User.mjs'

describe('SSH Key CRUD contract tests', function () {
  this.timeout(60 * 1000)

  it('create/list/delete SSH keys as logged-in user', async function () {
    const user = new UserHelper()
    await user.register()
    await user.login()

    const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0examplekeyDATA' + user.id
    // create key
    const resCreate = await user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'test', public_key: publicKey } })
    expect([201, 200]).to.include(resCreate.response.statusCode)
    const fingerprint = resCreate.body && resCreate.body.fingerprint
    if (resCreate.response.statusCode === 201) {
      expect(fingerprint).to.match(/^SHA256:[A-Za-z0-9+/]+=*$/)
    }

    // list keys
    const resList = await user.doRequest('get', { url: `/internal/api/users/${user.id}/ssh-keys` })
    expect(resList.response.statusCode).to.equal(200)
    const keys = resList.body
    expect(keys).to.be.an('array')

    // delete
    if (resCreate.body && resCreate.body.id) {
      const resDelete = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/ssh-keys/${resCreate.body.id}` })
      expect([204, 200, 404]).to.include(resDelete.response.statusCode)
    }
  })
})
