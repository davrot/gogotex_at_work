import RedisWrapper from '../infrastructure/RedisWrapper.js'
import logger from '@overleaf/logger'

const TTL = Number(process.env.CACHE_LOOKUP_TTL_SECONDS || process.env.CACHE_LOOKUP_TTL_SECONDS || 60)
const NEGATIVE_TTL = Number(process.env.CACHE_NEGATIVE_TTL_SECONDS || 5)

// Simple in-memory cache with TTL per entry
const cache = new Map()

function _now() { return Date.now() }

function _expireKeyIfNeeded(key) {
  const entry = cache.get(key)
  if (!entry) return
  if (entry.expiresAt && entry.expiresAt <= _now()) cache.delete(key)
}

export function get(key) {
  _expireKeyIfNeeded(key)
  const entry = cache.get(key)
  return entry ? entry.value : undefined
}

export function set(key, value, ttlSeconds = TTL) {
  const expiresAt = ttlSeconds > 0 ? _now() + ttlSeconds * 1000 : null
  cache.set(key, { value, expiresAt })
}

export function invalidate(key) {
  cache.delete(key)
}

// Subscribe to pubsub invalidation channel (if Redis available)
function _subscribeToInvalidate() {
  try {
    const client = RedisWrapper.client('pubsub')
    client.on('message', (channel, message) => {
      if (channel !== 'auth.cache.invalidate') return
      try {
        const msg = JSON.parse(message)
        const key = msg.key || msg.hashPrefix || msg.tokenId || msg.fingerprint || msg.newKey
        if (key) invalidate(key)
      } catch (e) {
        try { logger.err({ err: e, raw: message }, 'Failed to parse cache invalidate message') } catch (err2) {}
      }
    })
    client.subscribe('auth.cache.invalidate').catch(err => {
      try { logger.err({ err }, 'Failed to subscribe to cache invalidate channel') } catch (e) {}
    })
  } catch (err) {
    // ignore subscription failures in test environment
  }
}

_subscribeToInvalidate()

export default { get, set, invalidate }
