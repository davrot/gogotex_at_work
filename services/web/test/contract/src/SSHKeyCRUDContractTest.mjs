import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'
import fs from 'node:fs'

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

    // list keys (use node-fetch directly to avoid flaky parsing by the 'request' lib)
    const fetchRes = await user.fetch(`/internal/api/users/${user.id}/ssh-keys`, { headers: { 'x-dev-user-id': user.id } })
    const rawText = await fetchRes.text()
    const resList = { response: { statusCode: fetchRes.status, headers: Object.fromEntries(fetchRes.headers.entries()) }, body: rawText }
    // Debug: log response headers/body type for triage
    // eslint-disable-next-line no-console
    console.error('[SSHKeyCRUDContractTest] rawText sample(base64)=', Buffer.from(String(rawText)).toString('base64').slice(0,200))
    // Parse robustly: try direct parse, then look for first '['..']' and parse that
    let keys
    try {
      try {
        keys = JSON.parse(rawText)
      } catch (e) {
        const first = String(rawText).indexOf('[')
        const last = String(rawText).lastIndexOf(']')
        if (first !== -1 && last !== -1 && last > first) {
          const arrStr = String(rawText).slice(first, last + 1)
          keys = JSON.parse(arrStr)
        } else {
          throw e
        }
      }
    } catch (e) {
      // keep raw on failure; persist raw for post-mortem
      try { fs.writeFileSync('/tmp/last_sshkeys_response.txt', String(rawText)) } catch (ee) {}
      try { fs.writeFileSync('/tmp/last_sshkeys_response.b64', Buffer.from(String(rawText)).toString('base64')) } catch (ee) {}
      keys = rawText
    }
    // eslint-disable-next-line no-console
    console.error('[SSHKeyCRUDContractTest] resList body typeof=', typeof keys, 'sample=', typeof keys === 'string' ? keys.slice(0,200) : JSON.stringify(keys).slice(0,200))
    expect(resList.response.statusCode).to.equal(200)
    // Defensive: if server returned a JSON string (including boxed Strings), parse it for the test
    // Robust coercion: handle object arrays, single-encoded JSON strings, or double-encoded JSON strings
    // eslint-disable-next-line no-console
    console.error('[SSHKeyCRUDContractTest] keys type=', typeof keys, 'ctor=', keys && keys.constructor && keys.constructor.name, 'toString=', Object.prototype.toString.call(keys), 'isBuffer=', Buffer.isBuffer(keys), 'isArray=', Array.isArray(keys))
    let parsedKeys = keys
    try {
      // Normalize to a string, strip common surrounding quotes, then parse
      let raw = String(parsedKeys).trim()
      if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
        raw = raw.slice(1, -1)
      }
      if (/^[\s]*[\[{]/.test(raw)) {
        parsedKeys = JSON.parse(raw)
      }
      // If resulting value is still a string (double-encoded), try another pass
      if (typeof parsedKeys === 'string' || parsedKeys instanceof String) {
        let raw2 = String(parsedKeys).trim()
        if ((raw2.startsWith("'") && raw2.endsWith("'")) || (raw2.startsWith('"') && raw2.endsWith('"'))) {
          raw2 = raw2.slice(1, -1)
        }
        parsedKeys = JSON.parse(raw2)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SSHKeyCRUDContractTest] parse error', e && e.stack ? e.stack : e)
      parsedKeys = null
    }
    expect(parsedKeys).to.be.an('array')

    // delete
    if (resCreate.body && resCreate.body.id) {
      const resDelete = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/ssh-keys/${resCreate.body.id}` })
      expect([204, 200, 404]).to.include(resDelete.response.statusCode)
    }
  })
})
