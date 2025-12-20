import { expect } from 'chai'
import request from '../../acceptance/src/helpers/request.js'

describe('Disable rate-limits test endpoint (regression)', function () {
  this.timeout(60 * 1000)

  it('POST /internal/api/test/disable-rate-limits should disable rate limits for introspect and lookup', async function () {
    // Call the test endpoint to ensure the web process disables rate limits in-process
    const res = await new Promise((resolve, reject) => {
      request.post({ url: '/internal/api/test/disable-rate-limits', json: {} }, (err, response, body) => {
        if (err) return reject(err)
        resolve({ response, body })
      })
    })

    expect(res.response.statusCode).to.equal(200)
    expect(res.body && res.body.ok).to.equal(true)

    // Now exercise two rate-limited endpoints repeatedly and assert we do not see 429s
    const SettingsModule = await import('@overleaf/settings')
    const Settings = SettingsModule && (SettingsModule.default || SettingsModule)
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    const CLIENT = request.defaults({ headers: { Authorization: `Basic ${auth}` } })

    const introspectTarget = '/internal/api/tokens/introspect'
    const lookupTarget = '/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    // Perform a bunch of requests to each target and ensure none are 429
    for (let i = 0; i < 80; i++) {
      const r1 = await new Promise((resolve, reject) => CLIENT.post({ url: introspectTarget, json: { token: `bad-${i}` } }, (err, response, body) => err ? reject(err) : resolve({ response, body })))
      expect(r1.response.statusCode).to.not.equal(429)

      const r2 = await new Promise((resolve, reject) => CLIENT.get({ url: lookupTarget }, (err, response, body) => err ? reject(err) : resolve({ response, body })))
      expect(r2.response.statusCode).to.not.equal(429)
    }

    // Re-enable rate limits to avoid impacting other tests
    await new Promise((resolve, reject) => request.post({ url: '/internal/api/test/enable-rate-limits' }, (err, response, body) => err ? reject(err) : resolve({ response, body })))
  })
})
