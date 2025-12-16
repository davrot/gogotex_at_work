const Settings = require('@overleaf/settings')
const fs = require('fs')
// Allow tests to disable rate limits at runtime by creating '/tmp/disable-rate-limits' inside the container
if (process.env.DISABLE_RATE_LIMITS === 'true' || fs.existsSync('/tmp/disable-rate-limits')) {
  Settings.disableRateLimits = true
}
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const RedisWrapper = require('./RedisWrapper')
const RateLimiterFlexible = require('rate-limiter-flexible')
const OError = require('@overleaf/o-error')

const rclient = RedisWrapper.client('ratelimiter')

/**
 * Wrapper over the RateLimiterRedis class
 */
class RateLimiter {
  #opts

  /**
   * Create a rate limiter.
   *
   * @param name {string} The name that identifies this rate limiter. Different
   *                      rate limiters must have different names.
   * @param opts {object} Options to pass to RateLimiterRedis
   *
   * Some useful options:
   *
   *   points - number of points that can be consumed over the given duration
   *            (default: 4)
   *   subnetPoints - number of points that can be consumed over the given
   *                  duration accross a sub-network. This should only be used
   *                  ip-based rate limits.
   *   duration - duration of the fixed window in seconds (default: 1)
   *   blockDuration - additional seconds to block after all points are consumed
   *                   (default: 0)
   */
  constructor(name, opts = {}) {
    this.name = name
    this.#opts = Object.assign({}, opts)
    this._rateLimiter = new RateLimiterFlexible.RateLimiterRedis({
      ...opts,
      keyPrefix: `rate-limit:${name}`,
      storeClient: rclient,
    })
    if (opts.subnetPoints && !Settings.rateLimit?.subnetRateLimiterDisabled) {
      this._subnetRateLimiter = new RateLimiterFlexible.RateLimiterRedis({
        ...opts,
        points: opts.subnetPoints,
        keyPrefix: `rate-limit:${name}`,
        storeClient: rclient,
      })
    }
  }

  // Readonly access to the options, useful for aligning rate-limits.
  getOptions() {
    return Object.assign({}, this.#opts)
  }

  async consume(key, points = 1, options = { method: 'unknown' }) {
    try { console.debug(`[RateLimiter:${this.name}] Settings.disableRateLimits=${Settings.disableRateLimits} process.env.DISABLE_RATE_LIMITS=${process.env.DISABLE_RATE_LIMITS} process.env.TEST_DISABLE_RATE_LIMITS=${process.env.TEST_DISABLE_RATE_LIMITS}`) } catch (e) {}

    if (Settings.disableRateLimits || process.env.DISABLE_RATE_LIMITS === 'true') {
      // Return a fake result in case it's used somewhere
      try { const logger = require('@overleaf/logger'); logger.debug({ name: this.name, key }, 'rate-limiter disabled returning fake result') } catch (e) {}
      return {
        msBeforeNext: 0,
        remainingPoints: 100,
        consumedPoints: 0,
        isFirstInDuration: false,
      }
    }

    const res = await this.consumeForRateLimiter(this._rateLimiter, key, options, points)
    try { const logger = require('@overleaf/logger'); logger.debug({ name: this.name, key, res }, 'rate-limiter consume result') } catch (e) {}
    return res

    if (options.method === 'ip' && this._subnetRateLimiter) {
      const subnetKey = this.getSubnetKeyFromIp(key)
      await this.consumeForRateLimiter(
        this._subnetRateLimiter,
        subnetKey,
        options,
        points,
        'ip-subnet'
      )
    }
  }

  async consumeForRateLimiter(rateLimiter, key, options, points, method) {
    try {
      const res = await rateLimiter.consume(key, points, options)
      return res
    } catch (err) {
      if (err instanceof Error) {
        throw err
      } else {
        try { console.debug(`[RateLimiter:${this.name}] rate limit reached for key=${key} method=${method || options.method} err=${JSON.stringify(err)}`) } catch (e) {}
        // Only log the first time we exceed the rate limit for a given key and
        // duration. This happens when the previous amount of consumed points
        // was below the threshold.
        if (err.consumedPoints - points <= rateLimiter.points) {
          logger.warn({ path: this.name, key }, 'rate limit exceeded')
        }
        Metrics.inc('rate-limit-hit', 1, {
          path: this.name,
          method: method || options.method,
        })
        throw err
      }
    }
  }

  getSubnetKeyFromIp(ip) {
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
      throw new OError(
        'Cannot generate subnet key as the ip address is not of the expected format.',
        { ip }
      )
    }

    return ip.split('.').slice(0, 3).join('.')
  }

  async delete(key) {
    return await this._rateLimiter.delete(key)
  }
}

/*
 * Shared rate limiters
 */

const openProjectRateLimiter = new RateLimiter('open-project', {
  points: 15,
  duration: 60,
})

// Keep in sync with the can-skip-captcha options.
const overleafLoginRateLimiter = new RateLimiter(
  'overleaf-login',
  Settings.rateLimit?.login?.ip || {
    points: 20,
    subnetPoints: 200,
    duration: 60,
  }
)

// Rate limiters for auth endpoints — default to 60 req/min per service-origin
const tokenIntrospectRateLimiter = new RateLimiter('token-introspect', {
  points: 60,
  duration: 60,
})

const sshFingerprintLookupRateLimiter = new RateLimiter('ssh-fingerprint-lookup', {
  points: 60,
  duration: 60,
})

module.exports = {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
  tokenIntrospectRateLimiter,
  sshFingerprintLookupRateLimiter,
}
