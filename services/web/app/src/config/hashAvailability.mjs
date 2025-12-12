import { createRequire } from 'module'
const require = createRequire(import.meta.url)

export function assertHashAvailability(config = process.env) {
  const algo = config.AUTH_TOKEN_HASH_ALGO || 'argon2id'
  const allowFallback = (config.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK === 'true' || config.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK === true)

  if (algo === 'argon2id') {
    let argon2Present = true
    try { require('argon2') } catch (e) { argon2Present = false }
    if (!argon2Present) {
      if (allowFallback) {
        let bcryptPresent = true
        try { require('bcrypt') } catch (e) { bcryptPresent = false }
        if (!bcryptPresent) {
          throw new Error('AUTH_TOKEN_HASH_ALGO=argon2id configured but argon2 missing and bcrypt fallback unavailable')
        }
      } else {
        throw new Error('AUTH_TOKEN_HASH_ALGO=argon2id is configured but argon2 is not available; set AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK=true to permit bcrypt as fallback')
      }
    }
  }
  // bcrypt as canonical algorithm is always ok if bcrypt is present
  if (algo === 'bcrypt') {
    try { require('bcrypt') } catch (e) {
      throw new Error('AUTH_TOKEN_HASH_ALGO=bcrypt configured but bcrypt module missing')
    }
  }
  return true
}

export default assertHashAvailability
