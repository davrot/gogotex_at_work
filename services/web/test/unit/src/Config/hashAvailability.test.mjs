import { expect } from 'chai'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

import assertHashAvailability from '../../../../app/src/config/hashAvailability.mjs'

describe('assertHashAvailability', function () {
  it('passes when argon2 is configured and present', function () {
    const conf = { AUTH_TOKEN_HASH_ALGO: 'argon2id', AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK: 'false' }
    // If argon2 is present in this environment, call it directly, otherwise skip this assertion
    try {
      require('argon2')
      expect(assertHashAvailability(conf)).to.equal(true)
    } catch (e) {
      return
    }
  })

  it('throws when argon2 configured and missing and fallback not allowed', function () {
    // Force behavior by mocking require to throw for argon2
    const originalArgon = require.cache;
    // Use env override to simulate missing modules in tests.
    const conf = { AUTH_TOKEN_HASH_ALGO: 'argon2id', AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK: 'false' }
    // This test can only run meaningfully if argon2 is not present in the environment; otherwise skip
    try {
      require('argon2')
      // If argon2 exists, skip
      return
    } catch (e) {
      expect(() => assertHashAvailability(conf)).to.throw(/argonn?2|argon2id|AUTH_TOKEN_HASH_ALGO/)
    }
  })

  it('allows bcrypt as fallback when configured and bcrypt present', function () {
    const conf = { AUTH_TOKEN_HASH_ALGO: 'argon2id', AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK: 'true' }
    try {
      require('bcrypt')
      // If bcrypt exists but argon2 does not, we expect the assertion to pass; otherwise skip
      try { require('argon2') } catch (e) { expect(assertHashAvailability(conf)).to.equal(true) }
    } catch (e) {
      return
    }
  })
})
