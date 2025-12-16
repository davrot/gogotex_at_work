import { createRequire } from 'module'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
const { PersonalAccessToken } = require('../../models/PersonalAccessToken')

let argon2 = null
let bcrypt = null
try {
  argon2 = require('argon2')
} catch (e) {
  // argon2 not available
}
try {
  bcrypt = require('bcrypt')
} catch (e) {
  // bcrypt not available
}

function generatePlaintextToken (size = 32) {
  return crypto.randomBytes(size).toString('hex')
}

async function hashToken (token) {
  const algo = process.env.AUTH_TOKEN_HASH_ALGO || 'argon2id'
  const allowFallback = (process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK === 'true' || process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK === true)
  if (algo === 'argon2id' && argon2) {
    const time = parseInt(process.env.AUTH_TOKEN_ARGON2_TIME || '2', 10)
    const mem = parseInt(process.env.AUTH_TOKEN_ARGON2_MEMORY_KB || '65536', 10)
    const paral = parseInt(process.env.AUTH_TOKEN_ARGON2_PARALLELISM || '4', 10)
    const hash = await argon2.hash(token, { type: argon2.argon2id, timeCost: time, memoryCost: mem, parallelism: paral })
    return { hash, algorithm: 'argon2id' }
  }
  if (algo === 'argon2id' && !argon2) {
    // argon2 configured but not available
    if (!allowFallback) {
      throw new Error('ARGON2 configured as AUTH_TOKEN_HASH_ALGO but not available at runtime; set AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK to allow bcrypt fallback or install argon2')
    }
    // allowFallback is true; fall through to bcrypt below
  }
  if (bcrypt) {
    const cost = parseInt(process.env.AUTH_TOKEN_BCRYPT_COST || '12', 10)
    const hash = await bcrypt.hash(token, cost)
    return { hash, algorithm: 'bcrypt' }
  }
  // Fallback: use sha256-based pbkdf2 (not recommended) so manager still works
  const salt = crypto.randomBytes(16)
  const derived = crypto.pbkdf2Sync(token, salt, 100000, 64, 'sha256')
  const hash = `pbkdf2$${salt.toString('hex')}$${derived.toString('hex')}`
  return { hash, algorithm: 'pbkdf2' }
}

function computeHashPrefixFromPlain (tokenPlain) {
  const digest = crypto.createHash('sha256').update(tokenPlain).digest('hex')
  return digest.slice(0, 8)
}

async function verifyTokenAgainstHash (tokenPlain, storedHash) {
  if (argon2 && typeof storedHash === 'string' && storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, tokenPlain)
    } catch (e) {
      return false
    }
  }
  if (bcrypt && typeof storedHash === 'string' && storedHash.startsWith('$2')) {
    try {
      return await bcrypt.compare(tokenPlain, storedHash)
    } catch (e) {
      return false
    }
  }
  if (typeof storedHash === 'string' && storedHash.startsWith('pbkdf2$')) {
    try {
      const parts = storedHash.split('$')
      const salt = Buffer.from(parts[1], 'hex')
      const expected = parts[2]
      const derived = crypto.pbkdf2Sync(tokenPlain, salt, 100000, 64, 'sha256')
      return derived.toString('hex') === expected
    } catch (e) {
      return false
    }
  }
  return false
}

export default {
  async createToken (userId, { label = '', scopes = [], expiresAt = null, replace = false } = {}) {
    const tokenPlain = generatePlaintextToken()
    const hashPrefix = computeHashPrefixFromPlain(tokenPlain)
    const { hash, algorithm } = await hashToken(tokenPlain)
    if (replace && label) {
      // Revoke existing active tokens for the same userId+label
      const existing = await PersonalAccessToken.find({ userId, label, active: true })
      for (const e of existing) {
        await PersonalAccessToken.findOneAndUpdate({ _id: e._id }, { active: false })
        try { const pub = require('../../../lib/pubsub'); pub.publish('auth.cache.invalidate', { type: 'token.revoked', userId, tokenId: e._id.toString(), hashPrefix: e.hashPrefix }) } catch (e) {}
      }
    }
    const doc = new PersonalAccessToken({
      userId,
      label,
      hash,
      hashPrefix,
      algorithm,
      scopes,
      expiresAt,
      active: true,
    })
    await doc.save()

    return {
      token: tokenPlain,
      id: doc._id.toString(),
      hashPrefix: doc.hashPrefix,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    }
  },

  async listTokens (userId) {
    // Defensive: if the userId isn't a valid Mongo ObjectId, return empty list
    // instead of letting Mongoose throw a CastError which results in a 500.
    try {
      const mongoose = require('mongoose')
      if (!mongoose.Types.ObjectId.isValid(userId)) return []
    } catch (e) {
      // If mongoose isn't available for some reason, fall through and let the
      // query behave as before.
    }

    const tokens = await PersonalAccessToken.find({ userId }).sort({ createdAt: -1 }).lean()
    return tokens.map(t => ({
      id: t._id.toString(),
      label: t.label,
      scopes: t.scopes,
      active: t.active,
      hashPrefix: t.hashPrefix,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }))
  },

  async revokeToken (userId, tokenId) {
    const res = await PersonalAccessToken.findOneAndUpdate({ _id: tokenId, userId }, { active: false })
    if (res) {
      try {
        const pub = require('../../../lib/pubsub')
        // publish to a conventional channel; consumers can subscribe to 'auth.cache.invalidate'
        pub.publish('auth.cache.invalidate', { type: 'token.revoked', userId, tokenId: tokenId.toString(), hashPrefix: res.hashPrefix })
      } catch (e) {
        // swallow pubsub errors but log if logger available
        try { const logger = require('@overleaf/logger'); logger.err({ err: e, userId, tokenId }, 'failed to publish token.revoke invalidation') } catch (e2) {}
      }
    }
    return !!res
  },

  // Introspect by plain token value. Returns null if not found/invalid.
  async introspect (tokenPlain) {
    // Prefer a URL-based import to avoid resolution issues across environments
    let lookupCache
    try {
      // Check file exists first to avoid noisy ERR_MODULE_NOT_FOUND stack traces
      const fs = await import('fs')
      const lookupPath = new URL('../../../lib/lookupCache.mjs', import.meta.url).pathname
      if (fs.existsSync(lookupPath)) {
        lookupCache = await import(new URL('../../../lib/lookupCache.mjs', import.meta.url).href)
      } else {
        lookupCache = { default: { get: () => undefined, set: () => {}, invalidate: () => {} } }
      }
    } catch (e) {
      // If anything goes wrong, fall back to a no-op cache
      lookupCache = { default: { get: () => undefined, set: () => {}, invalidate: () => {} } }
    }
    const cacheKey = `introspect:${computeHashPrefixFromPlain(tokenPlain)}`
    const _lc = (lookupCache && lookupCache.default) || lookupCache
    const cached = _lc && _lc.get && _lc.get(cacheKey)
    if (typeof cached !== 'undefined') {
      return cached
    }

    const prefix = computeHashPrefixFromPlain(tokenPlain)
    const candidates = await PersonalAccessToken.find({ hashPrefix: prefix, active: true }).lean()
    for (const c of candidates) {
      const ok = await verifyTokenAgainstHash(tokenPlain, c.hash)
      if (ok) {
        const now = new Date()
        if (c.expiresAt && new Date(c.expiresAt) < now) { _lc && _lc.set && _lc.set(cacheKey, { active: false }, Number(process.env.CACHE_NEGATIVE_TTL_SECONDS || 5)); return { active: false } }
        const info = {
          active: true,
          userId: c.userId.toString(),
          scopes: c.scopes || [],
          expiresAt: c.expiresAt || null,
          hashPrefix: c.hashPrefix,
        }
        _lc && _lc.set && _lc.set(cacheKey, info, Number(process.env.CACHE_LOOKUP_TTL_SECONDS || 60))
        return info
      }
    }
    const missInfo = { active: false }
    _lc && _lc.set && _lc.set(cacheKey, missInfo, Number(process.env.CACHE_NEGATIVE_TTL_SECONDS || 5))
    return missInfo
  },
}
