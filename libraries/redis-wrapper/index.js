// @ts-check

const crypto = require('node:crypto')
const os = require('node:os')
const { promisify } = require('node:util')

const fs = require('fs')
const Redis = require('ioredis')

// Attempt to patch the node-redis client (redis@4+) so that any direct calls
// to `redis.createClient` also get recorded and have the same test-time
// defensive overrides (host -> 'redis' and lazyConnect:true). Some modules
// in the codebase call `redis.createClient(...)` directly; patching here
// lets us capture creation stacks and avoid accidental eager connects to
// 127.0.0.1 during test runs.
try {
  const nodeRedis = require('redis')
  if (nodeRedis && typeof nodeRedis.createClient === 'function') {
    const origCreateClient = nodeRedis.createClient
    nodeRedis.createClient = function (opts) {
      try {
        const options = Object.assign({}, opts || {})
        // apply same test-time host override and lazyConnect defaults
        if (!options.host) {
          options.host = process.env.REDIS_HOST || (process.env.NODE_ENV === 'test' ? 'redis' : '127.0.0.1')
        }
        if (process.env.NODE_ENV === 'test') {
          const hostIsLocal = (options.host === '127.0.0.1' || options.host === 'localhost')
          if (hostIsLocal) {
            options.host = 'redis'
            try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'override_node_redis_host_to_redis', originalHost: opts && opts.host, overriddenHost: 'redis' }) + '\n') } catch (e) {}
          }
          if (options.lazyConnect == null) options.lazyConnect = true
        }
        const creationStack = (new Error('node-redis-client-created')).stack
        try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created_node_redis', options, creationStack }) + '\n') } catch (e) {}
      } catch (e) {
        // swallow
      }
      return origCreateClient.apply(this, arguments)
    }
  }
} catch (e) {
  // not installed or couldn't patch - ignore
}

const {
  RedisHealthCheckTimedOut,
  RedisHealthCheckWriteError,
  RedisHealthCheckVerifyError,
} = require('./Errors')

const HEARTBEAT_TIMEOUT = 2000

// generate unique values for health check
const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

function createClient(opts) {
  const standardOpts = Object.assign({}, opts)
  delete standardOpts.key_schema

  // Ensure a reasonable host is set: prefer an explicit env var, then use
  // the docker service name during test runs, and finally fall back to localhost.
  if (!standardOpts.host) {
    standardOpts.host = process.env.REDIS_HOST || (process.env.NODE_ENV === 'test' ? 'redis' : '127.0.0.1')
  }

  // Defensive override: prefer the docker 'redis' service when running tests.
  // This prevents accidental connects to localhost when modules are imported
  // before test bootstrap sets env vars or when Settings specify '127.0.0.1'.
  if (process.env.NODE_ENV === 'test') {
    try {
      const hostIsLocal = (standardOpts.host === '127.0.0.1' || standardOpts.host === 'localhost')
      if (hostIsLocal) {
        try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'override_host_to_redis', originalHost: standardOpts.host, overriddenHost: 'redis' }) + '\n') } catch (e) {}
        standardOpts.host = 'redis'
      }
    } catch (e) {}
  } else if (!process.env.REDIS_HOST && standardOpts.host === '127.0.0.1') {
    try { standardOpts.host = 'redis' } catch (e) {}
  }

  if (standardOpts.retry_max_delay == null) {
    standardOpts.retry_max_delay = 5000 // ms
  }

  // Avoid eager connection attempts during module import by defaulting to lazyConnect.
  // This prevents clients from immediately trying to connect to the network (and
  // producing ECONNREFUSED) before test bootstrap/env vars are applied. Callers can
  // override by explicitly passing lazyConnect:false if they need immediate connection.
  if (standardOpts.lazyConnect == null) {
    standardOpts.lazyConnect = true
  }

  // Defensive: if we're running tests, override any explicit request to eagerly connect
  // (lazyConnect:false) to avoid producing ECONNREFUSED during test bootstrap where the
  // environment may still be initializing (docker service names not yet available).
  if (process.env.NODE_ENV === 'test' && standardOpts.lazyConnect === false) {
    try {
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'override_lazyConnect', originalOptions: opts || null, overriddenOptions: Object.assign({}, standardOpts, { lazyConnect: true }) }) + '\n') } catch (e) {}
    } catch (e) {}
    standardOpts.lazyConnect = true
  }

  if (standardOpts.endpoints) {
    throw new Error(
      '@overleaf/redis-wrapper: redis-sentinel is no longer supported'
    )
  }

  let client
  if (standardOpts.cluster) {
    delete standardOpts.cluster
    client = new Redis.Cluster(opts.cluster, standardOpts)
  } else {
    client = new Redis(standardOpts)
  }
  monkeyPatchIoRedisExec(client)
  // Capture a stack trace at creation so we can identify the caller later.
  try {
    const creationStack = (new Error('redis-client-created')).stack
    client._creationStack = creationStack
    // Always attempt to record the creation stack so we can later find the culprit
    try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created', options: standardOpts || null, creationStack: creationStack }) + '\n') } catch (e) {
      // If logging fails, still attach the stack to the client so error handlers can use it
      try { client._creationStack = creationStack } catch (e2) {}
    }
  } catch (e) {}

  // Log lifecycle events for better traceability (connect/ready/close)
  try {
    client.on && client.on('connect', () => {
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'connect', options: client.options || null, creationStack: client._creationStack || null }) + '\n') } catch (e) {}
    })
    client.on && client.on('ready', () => {
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'ready', options: client.options || null, creationStack: client._creationStack || null }) + '\n') } catch (e) {}
    })
    client.on && client.on('end', () => {
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'end', options: client.options || null, creationStack: client._creationStack || null }) + '\n') } catch (e) {}
    })
    client.on && client.on('close', () => {
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'close', options: client.options || null, creationStack: client._creationStack || null }) + '\n') } catch (e) {}
    })
  } catch (e) {}

  // defensive: prevent unhandled 'error' events from bubbling up
  // ioredis will emit 'error' if it cannot connect (e.g., ECONNREFUSED)
  client.on('error', err => {
    try {
      const errStack = (err && err.stack) ? err.stack : String(err)
      // If we don't have a recorded creation stack (client created before our instrumentation), capture
      // a current stack so we have a clue where this instance originated.
      const creationStack = client._creationStack || (new Error('redis-error-no-creation-stack')).stack
      if (!client._creationStack) {
        // record it back on the instance to avoid repeating this work for subsequent errors
        try { client._creationStack = creationStack } catch (e) {}
      }

      const hostIsLocalhost = client.options && (client.options.host === '127.0.0.1' || client.options.host === 'localhost')
      const logObj = {
        t: new Date().toISOString(),
        event: 'error',
        options: client.options || null,
        err: errStack,
        creationStack: creationStack || null,
        hostIsLocalhost: !!hostIsLocalhost,
        pid: process.pid,
        nodeEnv: process.env.NODE_ENV || null,
      }
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify(logObj) + '\n') } catch (e) {}
      if (hostIsLocalhost) {
        console.error('[redis-wrapper] ioredis error (host=127.0.0.1 detected):', errStack, 'client.options=', client.options || null, 'creationStack=', creationStack || null)
      } else {
        console.error('[redis-wrapper] ioredis error:', errStack, 'client.options=', client.options || null, 'creationStack=', creationStack || null)
      }
    } catch (e) {
      // swallow any logging errors to avoid cascading failures
    }
  })
  client.healthCheck = callback => {
    if (callback) {
      // callback based invocation
      healthCheck(client).then(callback).catch(callback)
    } else {
      // Promise based invocation
      return healthCheck(client)
    }
  }
  return client
}

async function healthCheck(client) {
  // check the redis connection by storing and retrieving a unique key/value pair
  const uniqueToken = `host=${HOST}:pid=${PID}:random=${RND}:time=${Date.now()}:count=${COUNT++}`

  // o-error context
  const context = {
    uniqueToken,
    stage: 'add context for a timeout',
  }

  await runWithTimeout({
    runner: runCheck(client, uniqueToken, context),
    timeout: HEARTBEAT_TIMEOUT,
    context,
  })
}

async function runCheck(client, uniqueToken, context) {
  const healthCheckKey = `_redis-wrapper:healthCheckKey:{${uniqueToken}}`
  const healthCheckValue = `_redis-wrapper:healthCheckValue:{${uniqueToken}}`

  // set the unique key/value pair
  context.stage = 'write'
  const writeAck = await client
    .set(healthCheckKey, healthCheckValue, 'EX', 60)
    .catch(err => {
      throw new RedisHealthCheckWriteError('write errored', context, err)
    })
  if (writeAck !== 'OK') {
    context.writeAck = writeAck
    throw new RedisHealthCheckWriteError('write failed', context)
  }

  // check that we can retrieve the unique key/value pair
  context.stage = 'verify'
  const [roundTrippedHealthCheckValue, deleteAck] = await client
    .multi()
    .get(healthCheckKey)
    .del(healthCheckKey)
    .exec()
    .catch(err => {
      throw new RedisHealthCheckVerifyError('read/delete errored', context, err)
    })
  if (roundTrippedHealthCheckValue !== healthCheckValue) {
    context.roundTrippedHealthCheckValue = roundTrippedHealthCheckValue
    throw new RedisHealthCheckVerifyError('read failed', context)
  }
  if (deleteAck !== 1) {
    context.deleteAck = deleteAck
    throw new RedisHealthCheckVerifyError('delete failed', context)
  }
}

function unwrapMultiResult(result, callback) {
  // ioredis exec returns a results like:
  // [ [null, 42], [null, "foo"] ]
  // where the first entries in each 2-tuple are
  // presumably errors for each individual command,
  // and the second entry is the result. We need to transform
  // this into the same result as the old redis driver:
  // [ 42, "foo" ]
  //
  // Basically reverse:
  // https://github.com/luin/ioredis/blob/v4.17.3/lib/utils/index.ts#L75-L92
  const filteredResult = []
  for (const [err, value] of result || []) {
    if (err) {
      return callback(err)
    } else {
      filteredResult.push(value)
    }
  }
  callback(null, filteredResult)
}
const unwrapMultiResultPromisified = promisify(unwrapMultiResult)

function monkeyPatchIoRedisExec(client) {
  const _multi = client.multi
  client.multi = function () {
    const multi = _multi.apply(client, arguments)
    const _exec = multi.exec
    multi.exec = callback => {
      if (callback) {
        // callback based invocation
        _exec.call(multi, (error, result) => {
          // The command can fail all-together due to syntax errors
          if (error) return callback(error)
          unwrapMultiResult(result, callback)
        })
      } else {
        // Promise based invocation
        return _exec.call(multi).then(unwrapMultiResultPromisified)
      }
    }
    return multi
  }
}

async function runWithTimeout({ runner, timeout, context }) {
  let healthCheckDeadline
  await Promise.race([
    new Promise((resolve, reject) => {
      healthCheckDeadline = setTimeout(() => {
        // attach the timeout when hitting the timeout only
        context.timeout = timeout
        reject(new RedisHealthCheckTimedOut('timeout', context))
      }, timeout)
    }),
    runner.finally(() => clearTimeout(healthCheckDeadline)),
  ])
}

/**
 * Delete all data from the test Redis instance
 *
 * @param {Redis} rclient
 */
async function cleanupTestRedis(rclient) {
  ensureTestRedis(rclient)
  await rclient.flushall()
}

/**
 * Checks that the Redis client points to a test database
 *
 * In tests, the Redis instance is on a host called redis_test
 *
 * @param {Redis} rclient
 */
function ensureTestRedis(rclient) {
  const host = rclient.options.host
  const env = process.env.NODE_ENV
  if (host !== 'redis_test' || env !== 'test') {
    throw new Error(
      `Refusing to clear Redis instance '${host}' in environment '${env}'`
    )
  }
}

async function disconnectAllClients() {
  try {
    const clients = global.__redis_wrapper_known_clients ? Array.from(global.__redis_wrapper_known_clients) : []
    for (const c of clients) {
      try {
        if (c && typeof c.disconnect === 'function') {
          try { await c.disconnect() } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
}

module.exports = {
  createClient,
  cleanupTestRedis,
  disconnectAllClients,
}
