import { describe, it, expect, vi } from 'vitest'
import mongoose from 'mongoose'

// Prevent OverwriteModelError / module cache issues by clearing mongoose models and reset modules
if (mongoose.deleteModel) {
  // Mongoose >=6 provides deleteModel
  try { mongoose.deleteModel('PersonalAccessToken') } catch (e) { /* ignore */ }
} else if (mongoose.models && mongoose.models.PersonalAccessToken) {
  delete mongoose.models.PersonalAccessToken
}

describe('revokeToken() synchronous eviction', () => {
  it('waits for lookupCache.invalidate to resolve', async () => {
    // Reset module cache and dynamically import modules to avoid multiple model compilation
    vi.resetModules()
    const { default: PAM, _setLookupCacheForTests } = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    const PATModel = await import('../../../../../app/src/models/PersonalAccessToken')

    const mockInvalidate = vi.fn(() => Promise.resolve(true))
    _setLookupCacheForTests({ invalidate: mockInvalidate })
    // stub DB update to return a result with hashPrefix
    const stub = vi.spyOn(PATModel.PersonalAccessToken, 'findOneAndUpdate').mockResolvedValue({ _id: 'tok-1', hashPrefix: 'abcd1234', userId: 'u1' })
    await PAM.revokeToken('u1', 'tok-1')
    expect(mockInvalidate).toHaveBeenCalled()
    stub.mockRestore()
  })
})
