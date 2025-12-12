export default function validateConfig(config) {
  const required = [
    'AUTH_TOKEN_HASH_ALGO',
    'AUTH_TOKEN_ARGON2_TIME',
    'AUTH_TOKEN_ARGON2_MEMORY_KB',
    'AUTH_TOKEN_ARGON2_PARALLELISM',
    'AUTH_TOKEN_BCRYPT_COST',
    'CACHE_LOOKUP_TTL_SECONDS',
    'CACHE_NEGATIVE_TTL_SECONDS',
  ]

  const missing = required.filter(k => typeof config[k] === 'undefined')
  if (missing.length) {
    throw new Error(`Missing required config keys: ${missing.join(', ')}`)
  }

  // Sanity checks
  const ttl = Number(config.CACHE_LOOKUP_TTL_SECONDS)
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('CACHE_LOOKUP_TTL_SECONDS must be positive number')

  const negativeTtl = Number(config.CACHE_NEGATIVE_TTL_SECONDS)
  if (!Number.isFinite(negativeTtl) || negativeTtl < 0) throw new Error('CACHE_NEGATIVE_TTL_SECONDS must be >= 0')

  // Accept AUTH_TOKEN_HASH_ALGO values
  if (!['argon2id', 'bcrypt'].includes(config.AUTH_TOKEN_HASH_ALGO)) {
    throw new Error('AUTH_TOKEN_HASH_ALGO must be one of argon2id|bcrypt')
  }

  // Optional: allow explicit fallback key to allow bcrypt if argon2 is unavailable
  if (config.AUTH_TOKEN_HASH_ALGO === 'argon2id' && config.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK !== 'true' && config.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK !== true) {
    // This is only a config-level check; runtime availability is validated separately by assertHashAvailability.
  }

  return true
}
