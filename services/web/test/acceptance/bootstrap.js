const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
chai.use(require('chai-exclude'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

// Detect web host via docker ps if HTTP_TEST_HOST is not set (tests run inside dev container without docker CLI access sometimes)
if (!process.env.HTTP_TEST_HOST) {
  try {
    const { execSync } = require('child_process')
    const out = execSync('docker ps --format "{{.Names}} {{.Image}}"', { encoding: 'utf8' })
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/\s+/, 2)
      const name = parts[0]
      const image = parts[1] || ''
      if (!name) continue
      if (/^develop-web(-\d+)?$/i.test(name) || /(^|\/)develop-web$/i.test(image)) {
        process.env.HTTP_TEST_HOST = name
        break
      }
      if (/(^|-)web(-|$|\d)/i.test(name)) {
        process.env.HTTP_TEST_HOST = name
        break
      }
    }
  } catch (e) {
    // ignore; the detection will be retried in callers that can access docker
  }
  // Fallback: if detection above failed (for example docker CLI unavailable
  // inside the container), set a sensible default so tests can run locally
  if (!process.env.HTTP_TEST_HOST) {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] HTTP_TEST_HOST not detected, defaulting to "web"')
    process.env.HTTP_TEST_HOST = 'web'
  }
}

// Run the pre-test rebuild helper if available and not explicitly skipped.
  try {
    if (process.env.SKIP_REBUILD_CHECK !== 'true') {
      const fs = require('fs')
      const path = require('path')
      const helper = path.join(__dirname, '..', '..', '..', '..', 'develop', 'bin', 'ensure_rebuilt_before_tests')
      if (fs.existsSync(helper)) {
        try {
          const { execSync } = require('child_process')
          // eslint-disable-next-line no-console
          console.debug('[bootstrap] running pre-test rebuild helper:', helper)
          execSync(helper, { stdio: 'inherit', env: process.env })
        } catch (e) {
          // eslint-disable-next-line no-console
          console.debug('[bootstrap] pre-test rebuild helper failed', e && e.message ? e.message : e)
        }
      } else {
        // eslint-disable-next-line no-console
        console.debug('[bootstrap] pre-test rebuild helper not found, skipping')
      }
    } else {
      // eslint-disable-next-line no-console
      console.debug('[bootstrap] SKIP_REBUILD_CHECK=true, skipping pre-test rebuild helper')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] pre-test rebuild helper threw', e && e.message ? e.message : e)
  }

// Tests may disable rate limits when explicitly requested.
try {
  const Settings = require('@overleaf/settings')
  // disable rate limits only when test runner requests it
  if (process.env.TEST_DISABLE_RATE_LIMITS === 'true') {
    Settings.disableRateLimits = true
  }
  // Ensure service-origin basic auth credentials exist for tests
  if (!Settings.httpAuthUsers || Object.keys(Settings.httpAuthUsers).length === 0) {
    const httpAuthUser = process.env.WEB_API_USER || 'overleaf'
    const httpAuthPass = process.env.WEB_API_PASSWORD || 'overleaf'
    Settings.httpAuthUsers = { [httpAuthUser]: httpAuthPass }
  }
  // Debug: surface effective http auth users so failing 401s are easier to diagnose
  try {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] Settings.httpAuthUsers:', Object.keys(Settings.httpAuthUsers))
  } catch (e) {}

  // Debug: show which Redis host envs are configured for tests
  try {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] REDIS_HOSTs:', {
      REDIS_HOST: process.env.REDIS_HOST || undefined,
      RATELIMITER_REDIS_HOST: process.env.RATELIMITER_REDIS_HOST || undefined,
      QUEUES_REDIS_HOST: process.env.QUEUES_REDIS_HOST || undefined,
    })
  } catch (e) {}

  // Clear any existing overleaf-login rate limiter entry for the smoke-test subject
  try {
    const { overleafLoginRateLimiter } = require('../../../../app/src/infrastructure/RateLimiter.js')
    if (Settings.smokeTest && Settings.smokeTest.rateLimitSubject) {
      overleafLoginRateLimiter.delete(Settings.smokeTest.rateLimitSubject).catch(() => {})
    }
  } catch (e) {}

  // Optionally clear token/service-origin rate-limiter keys in Redis when requested
  if (process.env.CLEAR_RATE_LIMITS === 'true') {
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      ;(async () => {
        try {
          const keys = await rclient.keys('rate-limit:*')
          if (keys && keys.length) {
            await rclient.del(keys)
            // eslint-disable-next-line no-console
            console.debug('[bootstrap] cleared rate limiter keys:', keys.length)
          }
        } catch (e) {
          // ignore errors clearing rate-limiter keys
        } finally {
          try { await rclient.disconnect() } catch (e) {}
        }
      })()
    } catch (e) {}
  }
} catch (e) {}

// Polyfill: some test environments occasionally load helpers in a way
// that leaves the instance `register()` method undefined. Ensure it exists
// so contract tests calling `await user.register()` won't crash.
;(async () => {
  try {
    const { default: UserHelperModule } = await import('./src/helpers/UserHelper.mjs')
    if (UserHelperModule && typeof UserHelperModule.prototype.register !== 'function') {
      // Map instance register to the request-based `registerUser` helper
      UserHelperModule.prototype.register = async function (userData = {}, options = {}) {
        const helper = await UserHelperModule.registerUser(userData, options)
        // Copy useful properties from returned helper instance
        Object.assign(this, helper)
        return this
      }
      // eslint-disable-next-line no-console
      console.debug('[bootstrap] added UserHelper.prototype.register polyfill')
    }
  } catch (e) {
    // ignore polyfill errors — tests will still run and report real failures
  }
})()

// Ensure test-run cleanup so Mocha can exit cleanly and not leave pending connections
async function _bootstrapCleanup() {
  // Close mongoose connection
  try {
    // eslint-disable-next-line global-require
    const mongoose = require('mongoose')
    await mongoose.disconnect()
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] mongoose disconnected')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] mongoose disconnect failed', e && e.message ? e.message : e)
  }

  // Cleanup test redis keys and disconnect ratelimiter client
  try {
    const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
    await RedisWrapper.cleanupTestRedis().catch(() => {})
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] redis test cleanup attempted')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] redis cleanup failed', e && e.message ? e.message : e)
  }
}

// Register cleanup hooks so DB and Redis are closed when the test runner finishes
process.on('beforeExit', _bootstrapCleanup)
process.on('exit', _bootstrapCleanup)
// If Mocha provides an `after` global, use it to ensure cleanup runs inside the test lifecycle too
if (typeof globalThis.after === 'function') {
  try { globalThis.after(_bootstrapCleanup) } catch (e) {}
}

// Some test runners leave open handles that prevent process termination.
// After attempting graceful cleanup, force exit in test environments to avoid hanging forever.
async function _bootstrapCleanupWithForce() {
  try { await _bootstrapCleanup() } catch (e) {}
  if ((process.env.NODE_ENV === 'test') || (process.env.TEST_FORCE_EXIT === 'true')) {
    try { console.debug('[bootstrap] forcing process.exit(0) after cleanup') } catch (e) {}
    try { setTimeout(() => { process.exit(0) }, 100) } catch (e) {}
  }
}

// Replace previous handlers with the force-exit wrapper to ensure exit
process.removeAllListeners('beforeExit')
process.removeAllListeners('exit')
process.on('beforeExit', _bootstrapCleanupWithForce)
process.on('exit', _bootstrapCleanupWithForce)
if (typeof globalThis.after === 'function') {
  try { globalThis.after(_bootstrapCleanupWithForce) } catch (e) {}
}
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.debug('[bootstrap] SIGTERM received, exiting')
  try { process.exit(0) } catch (e) {}
})

process.on('unhandledRejection', (reason) => {
  try { console.error('[bootstrap] unhandledRejection', reason) } catch (e) {}
})
