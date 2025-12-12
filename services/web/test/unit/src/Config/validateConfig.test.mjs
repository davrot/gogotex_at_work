import { expect } from 'chai'
import validateConfig from '../../../../app/src/config/validateConfig.mjs'

describe('validateConfig', function () {
  it('validates minimal correct config', function () {
    const conf = {
      AUTH_TOKEN_HASH_ALGO: 'argon2id',
      AUTH_TOKEN_ARGON2_TIME: '2',
      AUTH_TOKEN_ARGON2_MEMORY_KB: '65536',
      AUTH_TOKEN_ARGON2_PARALLELISM: '4',
      AUTH_TOKEN_BCRYPT_COST: '12',
      CACHE_LOOKUP_TTL_SECONDS: '60',
      CACHE_NEGATIVE_TTL_SECONDS: '5',
    }
    expect(validateConfig(conf)).to.equal(true)
  })

  it('throws on missing keys', function () {
    const conf = {}
    expect(() => validateConfig(conf)).to.throw(/Missing required config keys/)
  })
})
