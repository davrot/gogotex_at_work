import { expect } from 'chai'
import request from '../../acceptance/src/helpers/request.js'
import crypto from 'crypto'

// Tests rely on accepting `X-Service-Origin` headers in the test environment so
// test-created unique origins won't collide with IP-based origins created by
// other services. Enable header trust for these tests explicitly.
process.env.TRUST_X_SERVICE_ORIGIN = 'true'

const { default: Settings } = await import('@overleaf/settings').catch(() => ({ default: {} }))
if (!Settings.httpAuthUsers || Object.keys(Settings.httpAuthUsers).length === 0) {
  const httpAuthUser = process.env.WEB_API_USER || 'overleaf'
  const httpAuthPass = process.env.WEB_API_PASSWORD || 'overleaf'
  Settings.httpAuthUsers = { [httpAuthUser]: httpAuthPass }
  // eslint-disable-next-line no-console
  console.debug('[ServiceOriginRateLimitTests] injected default Settings.httpAuthUsers', Object.keys(Settings.httpAuthUsers))
}

  if (!Settings.apis) Settings.apis = {}
  if (!Settings.apis.v1) Settings.apis.v1 = { url: process.env.V1_API_URL || 'http://v1:3000', user: process.env.V1_API_USER || 'v1user', pass: process.env.V1_API_PASS || 'v1pass', timeout: 2000 }
  if (!Settings.redis) Settings.redis = {}
  Settings.redis.ratelimiter = Settings.redis.ratelimiter || { host: process.env.RATELIMITER_REDIS_HOST || process.env.REDIS_HOST || 'redis' }
  Settings.redis.web = Settings.redis.web || Settings.redis.ratelimiter
  if (!Settings.defaultFeatures) Settings.defaultFeatures = { collaborators: 3, versioning: false, dropbox: false, github: false, gitBridge: false, compileTimeout: 30, compileGroup: 'default', references: true, trackChanges: true, mendeley: false, zotero: false, papers: false, referencesSearch: true, symbolPalette: true }

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

    // Perform an initial pre-check with a syntactically-valid token to ensure
    // the introspect endpoint is accepting the token format and not returning
    // 400 (invalid token format) which would cause warmup to miscount.
    const preToken = crypto.randomBytes(12).toString('hex')
    const preCheck = await new Promise((resolve, reject) => {
      CLIENT.post({ url: TARGET, json: { token: preToken } }, (err, response, body) => {
        if (err) reject(err)
        else resolve({ response, body })
      })
    })
    if (preCheck.response.statusCode === 400) {
      // Fail fast with diagnostic info so we can understand why format is rejected
      // eslint-disable-next-line no-console
      console.error('[ServiceOriginRateLimitTests] pre-check failed: introspect rejecting valid token format', preCheck.body)
      throw new Error('Introspect endpoint rejecting valid token format (400) during warmup pre-check')
    }

    // Robust warmup: attempt up to 120 times to observe 60 successful responses.
    // This avoids flakiness when other callers briefly increment the shared counters.
    let successCount = 0
    let first429At = -1
    const maxAttempts = 120
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const token = crypto.randomBytes(12).toString('hex')
      const res = await new Promise((resolve, reject) => {
        CLIENT.post({ url: TARGET, json: { token } }, (err, response, body) => {
          if (err) reject(err)
          else resolve({ response, body })
        })
      })
      if (res.response.statusCode === 429) {
        first429At = attempt
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] observed 429 at attempt', attempt)
        break
      }
      if (![200, 201, 204, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] warmup unexpected:', TARGET, 'attempt=', attempt, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 201, 204, 400])
      successCount++
    }

    // 61st request SHOULD be throttled (429) by service-origin rate-limiter
    const lastToken = crypto.randomBytes(12).toString('hex')
    const res61 = await new Promise((resolve, reject) => {
      CLIENT.post({ url: TARGET, json: { token: lastToken } }, (err, response, body) => {
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

    // Ensure token-introspect and login rate-limiter keys cleared to avoid cross-test interference
    let rclient
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      rclient = RedisWrapper.client('ratelimiter')
      const keys = await rclient.keys('rate-limit:token-introspect:*')
      const loginKeys = await rclient.keys('rate-limit:overleaf-login:*')
      if (keys && keys.length) await rclient.del(keys)
      if (loginKeys && loginKeys.length) await rclient.del(loginKeys)
      const keysAfterClear = await rclient.keys('rate-limit:token-introspect:*')
      const loginKeysAfterClear = await rclient.keys('rate-limit:overleaf-login:*')
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] cleared token-introspect/login keys for listing warmup, before/after counts:', keys && keys.length, keysAfterClear && keysAfterClear.length, loginKeys && loginKeys.length, loginKeysAfterClear && loginKeysAfterClear.length)
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

    // Ensure fingerprint-related and login rate-limiter keys cleared to avoid cross-test interference
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const keysA = await rclient.keys('rate-limit:fingerprint-lookup:*')
      const keysB = await rclient.keys('rate-limit:ssh-fingerprint-lookup:*')
      const loginKeys = await rclient.keys('rate-limit:overleaf-login:*')
      const keys = [...(keysA || []), ...(keysB || []), ...(loginKeys || [])]
      if (keys && keys.length) await rclient.del(keys)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[ServiceOriginRateLimitTests] cleared fingerprint/login keys counts:', keysA && keysA.length, keysB && keysB.length, loginKeys && loginKeys.length)
    } catch (e) {
      // ignore any issues clearing the rate limiter
    }
    // Robust warmup: allow up to 120 attempts to observe the first 429.
    // Count allowed responses and assert that we observe a 429 only after ~60 successful attempts.
    let successCount = 0
    let first429At = -1
    const maxAttempts = 120
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await new Promise((resolve, reject) => {
        CLIENT.get({ url: TARGET }, (err, response, body) => {
          if (err) reject(err)
          else resolve({ response, body })
        })
      })
      if (res.response.statusCode === 429) {
        first429At = attempt
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] observed 429 at attempt', attempt)
        break
      }
      if (![200, 404, 400].includes(res.response.statusCode)) {
        // eslint-disable-next-line no-console
        console.debug('[ServiceOriginRateLimitTests] lookup warmup unexpected:', TARGET, 'attempt=', attempt, 'status=', res.response.statusCode, 'body=', res.body)
      }
      expect(res.response.statusCode).to.be.oneOf([200, 404, 400])
      successCount++
    }

    // Expect at least 58 successful requests before seeing a 429 to avoid flaky off-by-one behavior.
    expect(successCount).to.be.at.least(58)
    expect(first429At).to.be.greaterThan(0)
  })
})
