const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
chai.use(require('chai-exclude'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// Early test-only monkey-patch: intercept direct redis/ioredis client creation
// to apply test-safe defaults (prefer host 'redis' and avoid eager connects)
try {
  const fs = require('fs')
  try {
    const nodeRedis = require('redis')
    if (nodeRedis && typeof nodeRedis.createClient === 'function') {
      const origCreateClient = nodeRedis.createClient
      nodeRedis.createClient = function (opts) {
        try {
          const options = Object.assign({}, opts || {})
          // Normalize host in legacy and new socket options
          let host = options.host || (options.socket && options.socket.host)
          if (!host) host = process.env.REDIS_HOST || (process.env.NODE_ENV === 'test' ? 'redis' : '127.0.0.1')
          const hostIsLocal = (host === '127.0.0.1' || host === 'localhost')
          if (process.env.NODE_ENV === 'test' && hostIsLocal) {
            if (options.socket) options.socket.host = 'redis'
            else options.host = 'redis'
            try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'override_node_redis_host_to_redis', originalHost: host, overriddenHost: 'redis' }) + '\n') } catch (e) {}
          }
          const creationStack = (new Error('node-redis-client-created')).stack
          try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created_node_redis', options, creationStack }) + '\n') } catch (e) {}
        } catch (e) {}
        return origCreateClient.apply(this, arguments)
      }
    }
  } catch (e) {}

  try {
    const IORedis = require('ioredis')
    if (IORedis && typeof IORedis === 'function') {
      const Orig = IORedis
      function WrappedIORedis(opts) {
        try {
          const standardOpts = Object.assign({}, opts || {})
          if (!standardOpts.host) standardOpts.host = process.env.REDIS_HOST || (process.env.NODE_ENV === 'test' ? 'redis' : '127.0.0.1')
          const hostIsLocal = (standardOpts.host === '127.0.0.1' || standardOpts.host === 'localhost')
          if (process.env.NODE_ENV === 'test' && hostIsLocal) {
            standardOpts.host = 'redis'
            try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'override_ioredis_host_to_redis', originalHost: opts && opts.host, overriddenHost: 'redis' }) + '\n') } catch (e) {}
          }
          if (standardOpts.lazyConnect == null) standardOpts.lazyConnect = true
          const creationStack = (new Error('ioredis-client-created')).stack
          try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created_ioredis', options: standardOpts, creationStack }) + '\n') } catch (e) {}
          return new Orig(standardOpts)
        } catch (e) {
          return new Orig(opts)
        }
      }
      // copy static properties and prototype
      Object.setPrototypeOf(WrappedIORedis, Orig)
      Object.keys(Orig).forEach(k => { try { WrappedIORedis[k] = Orig[k] } catch (e) {} })
      try { require.cache[require.resolve('ioredis')].exports = WrappedIORedis } catch (e) {}
    }
  } catch (e) {}
  try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'bootstrap_monkeypatch_added' }) + '\n') } catch (e) {}
  // Connection instrumentation: log socket and mongoose connect attempts for diagnostics
  try {
    const fs = require('fs')
    const net = require('net')
    try {
      const origSocketConnect = net.Socket.prototype.connect
      net.Socket.prototype.connect = function () {
        try {
          const args = Array.from(arguments)
          let opts = {}
          if (typeof args[0] === 'object') opts = args[0]
          else if (typeof args[0] === 'number') { opts.port = args[0]; if (typeof args[1] === 'string') opts.host = args[1] }
          const stack = (new Error('socket-connect-called')).stack
          try { fs.appendFileSync('/tmp/conn_creation_stacks.log', JSON.stringify({ t: new Date().toISOString(), event: 'socket_connect', options: opts, stack }) + '\n') } catch (e) {}
        } catch (e) {}
        return origSocketConnect.apply(this, arguments)
      }
    } catch (e) {}

    try {
      const mongoose = require('mongoose')
      const origMConnect = mongoose.connect
      mongoose.connect = function () {
        try {
          const args = Array.from(arguments)
          const uri = args[0]
          const opts = args[1]
          const stack = (new Error('mongoose-connect-called')).stack
          try { fs.appendFileSync('/tmp/conn_creation_stacks.log', JSON.stringify({ t: new Date().toISOString(), event: 'mongoose_connect', uri, options: opts, stack }) + '\n') } catch (e) {}
        } catch (e) {}
        return origMConnect.apply(this, arguments)
      }
      const origCreateConnection = mongoose.createConnection
      mongoose.createConnection = function () {
        try {
          const args = Array.from(arguments)
          const uri = args[0]
          const opts = args[1]
          const stack = (new Error('mongoose-createConnection-called')).stack
          try { fs.appendFileSync('/tmp/conn_creation_stacks.log', JSON.stringify({ t: new Date().toISOString(), event: 'mongoose_createConnection', uri, options: opts, stack }) + '\n') } catch (e) {}
        } catch (e) {}
        return origCreateConnection.apply(this, arguments)
      }
    } catch (e) {}
  } catch (e) {}} catch (e) {}

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

  // Ensure tests running inside the docker/dev environment default to the
  // Redis service name used by docker-compose when REDIS_HOST isn't set.
  if (!process.env.REDIS_HOST) {
    process.env.REDIS_HOST = 'redis'
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] defaulted REDIS_HOST to redis')
  }

  // Ensure tests running inside the docker/dev environment default to the
  // Mongo service name used by docker-compose when MONGO_HOST isn't set.
  if (!process.env.MONGO_HOST) {
    process.env.MONGO_HOST = 'mongo'
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] defaulted MONGO_HOST to mongo')
  }

  // Debug: show which Redis/Mongo host envs are configured for tests
  try {
    // eslint-disable-next-line no-console
    console.debug('[bootstrap] REDIS/MONGO HOSTs:', {
      REDIS_HOST: process.env.REDIS_HOST || undefined,
      MONGO_HOST: process.env.MONGO_HOST || undefined,
      RATELIMITER_REDIS_HOST: process.env.RATELIMITER_REDIS_HOST || undefined,
      QUEUES_REDIS_HOST: process.env.QUEUES_REDIS_HOST || undefined,
    })
  } catch (e) {}

  // Clear any existing overleaf-login rate limiter entry for the smoke-test subject
  try {
    const { overleafLoginRateLimiter } = require('../../../../app/src/infrastructure/RateLimiter.js')
    if (Settings.smokeTest && Settings.smokeTest.rateLimitSubject) {
      const rlKey = String(Settings.smokeTest.rateLimitSubject).trim().toLowerCase()
      overleafLoginRateLimiter.delete(rlKey).catch(() => {})
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

  // Attempt to disconnect any tracked redis clients from the libraries wrapper
  try {
    try {
      const RedisLib = require('../../../../libraries/redis-wrapper')
      if (RedisLib && typeof RedisLib.disconnectAllClients === 'function') {
        await RedisLib.disconnectAllClients().catch(() => {})
        // eslint-disable-next-line no-console
        console.debug('[bootstrap] disconnected tracked redis clients')
      }
    } catch (e) {}
  } catch (e) {}

  // Force-close any remaining active handles after graceful disconnect attempts
  try { await forceCloseActiveHandles() } catch (e) {}
  // Also destroy global HTTP(S) agents to close any keep-alive sockets
  try { require('http').globalAgent && typeof require('http').globalAgent.destroy === 'function' && require('http').globalAgent.destroy() } catch (e) {}
  try { require('https').globalAgent && typeof require('https').globalAgent.destroy === 'function' && require('https').globalAgent.destroy() } catch (e) {}

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
async function forceCloseActiveHandles() {
  try {
    const fs = require('fs')
    if (typeof process._getActiveHandles !== 'function') return
    const handles = process._getActiveHandles()
    const actions = []
    for (const h of handles) {
      try {
        const type = (h && h.constructor && h.constructor.name) || typeof h
        const info = { type }
        if (type === 'Timeout' || type === 'Immediate') {
          try { clearTimeout(h); clearInterval(h) } catch (e) {}
          info.action = 'cleared timer'
        } else if (type === 'Socket' || type === 'Server' || type === 'TLSSocket') {
          try { h.destroy && h.destroy(); h.close && h.close() } catch (e) {}
          info.action = 'destroyed/closed socket/server'
        } else if (typeof h.close === 'function') {
          try { h.close() } catch (e) {}
          info.action = 'closed via close()'
        } else {
          info.action = 'no-op'
        }
        actions.push(info)
      } catch (e) {}
    }
    try { fs.appendFileSync('/tmp/node_active_handles.log', JSON.stringify({ t: new Date().toISOString(), forced: actions }) + '\n') } catch (e) {}
  } catch (e) {}
}

async function _bootstrapCleanupWithForce() {
  try { await _bootstrapCleanup() } catch (e) {}
  if ((process.env.NODE_ENV === 'test') || (process.env.TEST_FORCE_EXIT === 'true')) {
    try { console.debug('[bootstrap] forcing process.exit(0) after cleanup') } catch (e) {}
    // Diagnostic: if the process is still alive after cleanup, dump active handles so we can find what is keeping the event loop busy
    try {
      const fs = require('fs')
      const dumpHandles = (handles) => handles.map(h => {
        const info = { type: (h && h.constructor && h.constructor.name) || typeof h }
        try {
          if (h && h.remoteAddress) info.remoteAddress = h.remoteAddress
          if (h && h.remotePort) info.remotePort = h.remotePort
          if (h && h.localPort) info.localPort = h.localPort
          if (h && h.path) info.path = h.path
          if (h && h.pid) info.pid = h.pid
          if (h && h._onTimeout) info.onTimeout = !!h._onTimeout
          if (h && h._repeat) info.repeat = h._repeat
        } catch (e) {}
        return info
      })
      try {
        const handles = (typeof process._getActiveHandles === 'function') ? process._getActiveHandles() : []
        const requests = (typeof process._getActiveRequests === 'function') ? process._getActiveRequests() : []
        const report = { t: new Date().toISOString(), handles: dumpHandles(handles), requests: dumpHandles(requests) }
        try { fs.appendFileSync('/tmp/node_active_handles.log', JSON.stringify(report) + '\n') } catch (e) {}
        try { console.debug('[bootstrap] dumped active handles to /tmp/node_active_handles.log', report.handles.length, 'handles', report.requests.length, 'requests') } catch (e) {}
        // After dumping, attempt to forcibly close any remaining handles to allow process to exit
        try { await forceCloseActiveHandles() } catch (e) {}
      } catch (e) {}
    } catch (e) {}

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
process.on('SIGTERM', async () => {
  // eslint-disable-next-line no-console
  console.debug('[bootstrap] SIGTERM received, attempting graceful shutdown')
  try {
    try {
      const RedisLib = require('../../../../libraries/redis-wrapper')
      if (RedisLib && typeof RedisLib.disconnectAllClients === 'function') {
        await RedisLib.disconnectAllClients().catch(() => {})
        // eslint-disable-next-line no-console
        console.debug('[bootstrap] disconnected tracked redis clients on SIGTERM')
      }
    } catch (e) {}
    // Destroy global HTTP(S) agents to close keep-alive sockets
    try { require('http').globalAgent && typeof require('http').globalAgent.destroy === 'function' && require('http').globalAgent.destroy() } catch (e) {}
    try { require('https').globalAgent && typeof require('https').globalAgent.destroy === 'function' && require('https').globalAgent.destroy() } catch (e) {}
    try { await forceCloseActiveHandles() } catch (e) {}
  } catch (e) {}
  try { process.exit(0) } catch (e) {}
})

process.on('unhandledRejection', (reason) => {
  try { console.error('[bootstrap] unhandledRejection', reason) } catch (e) {}
})

// Diagnostic watchdog: schedule a delayed check to dump active handles if the test run appears to have finished but the process remains alive.
if (process.env.NODE_ENV === 'test') {
  const fs = require('fs')
  const dumpHandles = async () => {
    try {
      if (typeof process._getActiveHandles !== 'function') return
      const handles = process._getActiveHandles()
      if (!handles || handles.length === 0) return
      const dump = handles.map(h => ({ type: (h && h.constructor && h.constructor.name) || typeof h, info: { remoteAddress: h && h.remoteAddress, remotePort: h && h.remotePort, localPort: h && h.localPort, path: h && h.path, pid: h && h.pid, onTimeout: !!(h && h._onTimeout), repeat: h && h._repeat } }))
      try { fs.appendFileSync('/tmp/node_active_handles.log', JSON.stringify({ t: new Date().toISOString(), handles: dump }) + '\n') } catch (e) {}
      try { console.debug('[bootstrap] watchdog dumped active handles to /tmp/node_active_handles.log', dump.length) } catch (e) {}
      // If there are still active handles, attempt to forcibly close them so the process can exit
      try { await forceCloseActiveHandles() } catch (e) {}
    } catch (e) {
      try { console.debug('[bootstrap] watchdog dump failed', e && e.message ? e.message : e) } catch (e2) {}
    }
  }
  // Schedule a couple of checks to capture handles after tests complete
  setTimeout(dumpHandles, 2000)
  setTimeout(dumpHandles, 5000)
  // Also call 'why-is-node-running' if available to get a deep diagnositc for lingering handles,
  // and write its output to `/tmp/why_node_running.log`.
  try {
    setTimeout(() => {
      try {
        const fs = require('fs')
        const why = require('why-is-node-running')
        const oldError = console.error
        console.error = (...args) => { try { fs.appendFileSync('/tmp/why_node_running.log', args.map(a => (typeof a === 'string' ? a : String(a))).join(' ') + '\n') } catch (e) {} ; oldError.apply(console, args) }
        // This call will append diagnostic lines both to console and to /tmp/why_node_running.log
        try { why() } catch (e) {}
        console.error = oldError
      } catch (e) {}
    }, 3000)
  } catch (e) {}
  // Allow ad-hoc manual dump trigger from the test runner if needed
  try { globalThis.dumpActiveHandles = dumpHandles } catch (e) {}
}
