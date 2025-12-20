import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Import manager module (default export)
const managerModule = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
const manager = managerModule.default

// Import the model and stub `find` to inspect queries
const PersonalAccessTokenModel = require('../../../../../app/src/models/PersonalAccessToken')

describe('PersonalAccessToken hashPrefix behavior', function () {
  it('computeHashPrefix derived from sha256(tokenPlain).slice(0,8) is used for queries', async function () {
    const tokenPlain = 'test-token-12345'
    const expectedPrefix = crypto.createHash('sha256').update(tokenPlain).digest('hex').slice(0, 8)

    // stub the model find to capture the query
    const originalFind = PersonalAccessTokenModel.PersonalAccessToken.find
    let capturedQuery = null
    PersonalAccessTokenModel.PersonalAccessToken.find = vi.fn((query) => {
      capturedQuery = query
      return { lean: () => Promise.resolve([]) }
    })

    try {
      // Call introspect which should compute prefix and call find with it
      await manager.introspect(tokenPlain)
      expect(capturedQuery).not.toBeNull()
      expect(capturedQuery.hashPrefix).toBe(expectedPrefix)
    } finally {
      // restore
      PersonalAccessTokenModel.PersonalAccessToken.find = originalFind
    }
  })

  it('createToken returns a hashPrefix that matches sha256(tokenPlain).slice(0,8)', async function () {
    // Stub model save to avoid DB dependency
    const originalSave = PersonalAccessTokenModel.PersonalAccessToken.prototype.save
    let lastDoc = null
    PersonalAccessTokenModel.PersonalAccessToken.prototype.save = vi.fn(function () {
      // mimic mongoose behavior
      this._id = this._id || { toString: () => 'mock-id' }
      this.createdAt = new Date()
      lastDoc = this
      return Promise.resolve(this)
    })

    try {
      // allow bcrypt fallback if argon2 isn't available
      const prevAllow = process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK
      process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK = 'true'
      const res = await manager.createToken('u-1', { label: 'lbl', scopes: [] })
      // restore env
      if (typeof prevAllow === 'undefined') delete process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK
      else process.env.AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK = prevAllow

      expect(res).toHaveProperty('token')
      expect(res).toHaveProperty('hashPrefix')
      const expectedPrefix = crypto.createHash('sha256').update(res.token).digest('hex').slice(0, 8)
      expect(res.hashPrefix).toBe(expectedPrefix)
      // verify the stored doc had the same value
      expect(lastDoc.hashPrefix).toBe(expectedPrefix)
      // verify format: 8 lowercase hex chars
      expect(/^[0-9a-f]{8}$/.test(res.hashPrefix)).toBe(true)
    } finally {
      PersonalAccessTokenModel.PersonalAccessToken.prototype.save = originalSave
    }
  })
})