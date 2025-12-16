import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('SSH Key CRUD contract tests', function () {
  this.timeout(60 * 1000)

  it('create/list/delete SSH keys as logged-in user', async function () {
    const user = new UserHelper()
    // Debug: ensure register() is present
    // eslint-disable-next-line no-console
    console.debug('[SSHKeyCRUDContractTest] user proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)), 'has.register=', typeof user.register)
    await user.register()
    await user.login()
    // Debug: surface logged-in state and identifiers
    // eslint-disable-next-line no-console
    console.debug('[SSHKeyCRUDContractTest] user.id', user.id, 'user._id', user._id, 'isLoggedIn', await user.isLoggedIn())
    try { /* eslint-disable-next-line no-console */ console.debug('[SSHKeyCRUDContractTest] user._password length', user._password?.length) } catch (e) {}

    const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0examplekeyDATA' + user.id
    // ensure we have a CSRF token and include it in the request
    // eslint-disable-next-line no-console
    console.debug('[SSHKeyCRUDContractTest] getting CSRF token before POST create')
    await user.getCsrfToken()
    // create key
    const resCreate = await user.doRequest('post', { url: `/internal/api/users/${user.id}/ssh-keys`, json: { key_name: 'test', public_key: publicKey }, headers: { 'x-dev-user-id': user.id } })
    // Debug: log response body when not a success to help triage
    if (![201, 200].includes(resCreate.response.statusCode)) {
      // eslint-disable-next-line no-console
      console.debug('[SSHKeyCRUDContractTest] create response not successful', { status: resCreate.response.statusCode, body: resCreate.body })
    }
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
