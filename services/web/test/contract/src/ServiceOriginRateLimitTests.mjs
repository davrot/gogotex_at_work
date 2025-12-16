import { expect } from 'chai'
import request from '../../acceptance/src/helpers/request.js'
import Settings from '@overleaf/settings'

// Tests rely on accepting `X-Service-Origin` headers in the test environment so
// test-created unique origins won't collide with IP-based origins created by
// other services. Enable header trust for these tests explicitly.
process.env.TRUST_X_SERVICE_ORIGIN = 'true'

describe('Service-Origin Rate Limits (contract test scaffold)', function () {
  this.timeout(60 * 1000)

  it('should enforce 60 req/min per service-origin for introspection', async function () {
    const SERVICE_ORIGIN = `contract-test-service-origin-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    const CLIENT = request.defaults({ headers: { 'X-Service-Origin': SERVICE_ORIGIN, Authorization: `Basic ${auth}` } })

    const TARGET = '/internal/api/tokens/introspect'

    // Ensure token-introspect rate-limiter keys cleared to avoid cross-test interference
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const keys = await rclient.keys('rate-limit:token-introspect:*')
      if (keys && keys.length) await rclient.del(keys)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] cleared token-introspect keys:', keys && keys.length)
    } catch (e) {
      // ignore any issues clearing the rate limiter
    }

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
  })

  it('should enforce 60 req/min per service-origin for listing', async function () {
    const SERVICE_ORIGIN = `contract-test-service-origin-list-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const LIST_TARGET = '/internal/api/users/u1/git-tokens'

    // Ensure token-introspect rate-limiter keys cleared to avoid cross-test interference
    let rclient
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      rclient = RedisWrapper.client('ratelimiter')
      const keys = await rclient.keys('rate-limit:token-introspect:*')
      if (keys && keys.length) await rclient.del(keys)
      const keysAfterClear = await rclient.keys('rate-limit:token-introspect:*')
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] cleared token-introspect keys for listing warmup, before/after counts:', keys && keys.length, keysAfterClear && keysAfterClear.length)
    } catch (e) {}

    const UserHelper = (await import('../../acceptance/src/helpers/UserHelper.mjs')).default
    const testUser = await UserHelper.createUser({})

    try {
      const keysAfterCreate = await rclient.keys('rate-limit:token-introspect:*')
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] token-introspect keys after user.createUser (before re-clear):', keysAfterCreate)
      if (keysAfterCreate && keysAfterCreate.length) {
        await rclient.del(keysAfterCreate)
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] token-introspect keys re-cleared after user.createUser')
      }

      // Inspect token-introspect keys immediately before starting the warm-up loop to
      // diagnose any unexpected pre-existing counters that would cause an immediate 429.
      try {
        const keysBeforeLoop = await rclient.keys('rate-limit:token-introspect:*')
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] token-introspect keys before warmup loop:', keysBeforeLoop)
      } catch (e) {
        // ignore
      }
    } catch (e) {}

    try { await rclient.disconnect() } catch (e) {}

    // Inspect token-introspect keys immediately before starting the warm-up loop to
    // diagnose any unexpected pre-existing counters that would cause an immediate 429.
    try {
      const keysBeforeLoop = await rclient.keys('rate-limit:token-introspect:*')
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] token-introspect keys before warmup loop:', keysBeforeLoop)
    } catch (e) {
      // ignore
    }

    // Debug: inspect session & headers on server-side before starting warmup
    try {
      const serverEcho = await testUser.doRequest('post', { url: '/internal/api/debug/echo', headers: { 'X-Service-Origin': SERVICE_ORIGIN, 'X-Debug-Echo': '1' } })
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] debug echo before list warmup:', serverEcho && serverEcho.body)
    } catch (e) {}

    for (let i = 0; i < 60; i++) {
      const res = await testUser.doRequest('get', { url: LIST_TARGET, headers: { 'X-Service-Origin': SERVICE_ORIGIN } })
      if (![200, 404, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] list warmup unexpected:', LIST_TARGET, 'i=', i, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 404, 400])
    }
    const res61List = await testUser.doRequest('get', { url: LIST_TARGET, headers: { 'X-Service-Origin': SERVICE_ORIGIN } })
    expect(res61List.response.statusCode).to.equal(429)
  })

  it('should enforce 60 req/min per service-origin for fingerprint lookup', async function () {
    const SERVICE_ORIGIN = `contract-test-service-origin-lookup-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    const CLIENT = request.defaults({ headers: { 'X-Service-Origin': SERVICE_ORIGIN, Authorization: `Basic ${auth}` } })
    const TARGET = '/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    // Ensure ssh-fingerprint-lookup rate-limiter keys cleared to avoid cross-test interference
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const keys = await rclient.keys('rate-limit:ssh-fingerprint-lookup:*')
      if (keys && keys.length) await rclient.del(keys)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] cleared ssh-fingerprint-lookup keys:', keys && keys.length)
    } catch (e) {
      // ignore any issues clearing the rate limiter
    }
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
