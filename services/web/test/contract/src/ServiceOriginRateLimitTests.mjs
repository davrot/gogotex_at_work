import { expect } from 'chai'
import request from '../../acceptance/src/helpers/request.js'
import Settings from '@overleaf/settings'

describe('Service-Origin Rate Limits (contract test scaffold)', function () {
  this.timeout(60 * 1000)

  it('should enforce 60 req/min per service-origin for introspection/listing', async function () {
    const SERVICE_ORIGIN = 'contract-test-service-origin'
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    const CLIENT = request.defaults({ headers: { 'X-Service-Origin': SERVICE_ORIGIN, Authorization: `Basic ${auth}` } })

    const TARGET = '/internal/api/tokens/introspect'

    // perform 60 requests; expect 200s or 200 with active:false
    for (let i = 0; i < 60; i++) {
      const res = await new Promise((resolve, reject) => {
        CLIENT.post({ url: TARGET, json: { token: `bad-${i}` } }, (err, response, body) => {
          if (err) reject(err);
          else resolve({ response, body })
        })
      })
      // Debug: show any unexpected status during warm-up
      if (![200, 201, 204, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] warmup unexpected:', TARGET, 'i=', i, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 201, 204, 400])
    }

    // 61st request SHOULD be throttled (429) by service-origin rate-limiter
    const res61 = await new Promise((resolve, reject) => {
      CLIENT.post({ url: TARGET, json: { token: 'bad-last' } }, (err, response, body) => {
        if (err) reject(err);
        else resolve({ response, body })
      })
    })

    // Debug if we didn't get a 429
    if (res61.response.statusCode !== 429) {
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] expected 429 but got', res61.response.statusCode, 'body=', res61.body)
    }

    // Enforce 429 to make this a concrete contract test; CI should configure the rate limiter accordingly.
    expect(res61.response.statusCode).to.equal(429)

    // Now test listing rate-limit for the same service-origin
    const LIST_TARGET = '/internal/api/users/u1/git-tokens'
    for (let i = 0; i < 60; i++) {
      const res = await new Promise((resolve, reject) => {
        CLIENT.get({ url: LIST_TARGET }, (err, response, body) => {
          if (err) reject(err)
          else resolve({ response, body })
        })
      })
      if (![200, 404, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] list warmup unexpected:', LIST_TARGET, 'i=', i, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 404, 400])
    }
    const res61List = await new Promise((resolve, reject) => {
      CLIENT.get({ url: LIST_TARGET }, (err, response, body) => {
        if (err) reject(err)
        else resolve(response)
      })
    })
    expect(res61List.statusCode).to.equal(429)
  })

  it('should enforce 60 req/min per service-origin for fingerprint lookup', async function () {
    const SERVICE_ORIGIN = 'contract-test-service-origin-lookup'
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    const CLIENT = request.defaults({ headers: { 'X-Service-Origin': SERVICE_ORIGIN, Authorization: `Basic ${auth}` } })
    const TARGET = '/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    // perform 60 requests; expect 2xx/404/400
    for (let i = 0; i < 60; i++) {
      const res = await new Promise((resolve, reject) => {
        CLIENT.get({ url: TARGET }, (err, response, body) => {
          if (err) reject(err)
          else resolve({ response, body })
        })
      })
      if (![200, 404, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] lookup warmup unexpected:', TARGET, 'i=', i, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 404, 400])
    }
    const res61 = await new Promise((resolve, reject) => {
      CLIENT.get({ url: TARGET }, (err, response, body) => {
        if (err) reject(err)
        else resolve({ response, body })
      })
    })
    if (res61.response.statusCode !== 429) {
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] expected lookup 429 but got', res61.response.statusCode, 'body=', res61.body)
    }
    expect(res61.response.statusCode).to.equal(429)
  })
})
