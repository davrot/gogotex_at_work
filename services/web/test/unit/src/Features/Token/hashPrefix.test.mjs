import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Ensure module picks up local DB behavior (opt out of WebProfile delegation)
const _origUseWebprofile = process.env.AUTH_TOKEN_USE_WEBPROFILE_API
process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'false'

// Import the model (use the services/web copy) so tests can stub methods before importing the manager
import path from 'node:path'
const PersonalAccessTokenModel = require(path.resolve(process.cwd(), 'app/src/models/PersonalAccessToken'))

// Helper: import a fresh manager after any desired stubs are in place
async function freshManager () {
  const managerModule = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
  return managerModule.default
}

// restore env for other tests
if (_origUseWebprofile === undefined) delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
else process.env.AUTH_TOKEN_USE_WEBPROFILE_API = _origUseWebprofile

describe('PersonalAccessToken hashPrefix behavior', function () {
  it('computeHashPrefix derived from sha256(tokenPlain).slice(0,8) is used for queries', async function () {
    const tokenPlain = 'test-token-12345'
    const expectedPrefix = crypto.createHash('sha256').update(tokenPlain).digest('hex').slice(0, 8)

    // Stub model find on both module export and mongoose.models to capture the query
    const mongoose = require('mongoose')
    let originalFindModule = null
    let originalFindMongoose = null
    let capturedQuery = null

    if (PersonalAccessTokenModel.PersonalAccessToken) {
      originalFindModule = PersonalAccessTokenModel.PersonalAccessToken.find
      PersonalAccessTokenModel.PersonalAccessToken.find = vi.fn((query) => {
        capturedQuery = query
        return { lean: () => Promise.resolve([]) }
      })
    }
    if (mongoose && mongoose.models && mongoose.models.PersonalAccessToken) {
      originalFindMongoose = mongoose.models.PersonalAccessToken.find
      mongoose.models.PersonalAccessToken.find = vi.fn((query) => {
        capturedQuery = query
        return { lean: () => Promise.resolve([]) }
      })
    }

    try {
      // Ensure we force local DB behavior while importing the manager so it will query the DB
      const prevUseWebprofile = process.env.AUTH_TOKEN_USE_WEBPROFILE_API
      process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'false'
      try {
        // Import a fresh manager after stubbing so it picks up the stubbed model
        const manager = await freshManager()
        // Call introspect which should compute prefix and call find with it
        await manager.introspect(tokenPlain)
        // Assert that a query was captured with the expected hashPrefix
        expect(capturedQuery).not.toBeNull()
        expect(capturedQuery.hashPrefix).toBe(expectedPrefix)
      } finally {
        if (typeof prevUseWebprofile === 'undefined') delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
        else process.env.AUTH_TOKEN_USE_WEBPROFILE_API = prevUseWebprofile
      }
    } finally {
      // restore safely depending on where we patched
      try {
        if (originalFindModule) PersonalAccessTokenModel.PersonalAccessToken.find = originalFindModule
        if (originalFindMongoose) mongoose.models.PersonalAccessToken.find = originalFindMongoose
      } catch (e) {
        // ignore restore errors in cleanup
      }
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
      // Import a fresh manager after stubbing so it picks up the stubbed model
      const manager = await freshManager()
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