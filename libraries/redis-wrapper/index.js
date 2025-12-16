// @ts-check

const crypto = require('node:crypto')
const os = require('node:os')
const { promisify } = require('node:util')

const Redis = require('ioredis')

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

  // Defensive override: if a caller explicitly provided '127.0.0.1' via settings
  // but REDIS_HOST was not set, and we're running in a dockerized test environment,
  // prefer connecting to the 'redis' service name so tests connect to containerized
  // Redis instead of local host. This helps when module imports happen before
  // test bootstrap sets env vars.
  if (!process.env.REDIS_HOST && standardOpts.host === '127.0.0.1') {
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
    try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created', options: standardOpts || null, creationStack: creationStack }) + '\n') } catch (e) {}
  } catch (e) {}

  // defensive: prevent unhandled 'error' events from bubbling up
  // ioredis will emit 'error' if it cannot connect (e.g., ECONNREFUSED)
  client.on('error', err => {
    try {
      const errStack = (err && err.stack) ? err.stack : String(err)
      const logObj = { t: new Date().toISOString(), event: 'error', options: client.options || null, err: errStack, creationStack: client._creationStack || null }
      try { fs.appendFileSync('/tmp/redis_clients.log', JSON.stringify(logObj) + '\n') } catch (e) {}
      console.error('[redis-wrapper] ioredis error:', errStack, 'client.options=', client.options || null, 'creationStack=', client._creationStack || null)
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

module.exports = {
  createClient,
  cleanupTestRedis,
}
