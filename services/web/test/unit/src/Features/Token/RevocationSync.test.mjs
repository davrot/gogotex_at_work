import { describe, it, expect, vi } from 'vitest'

import PAM, { _setLookupCacheForTests } from '../../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
import * as PATModel from '../../../../../../app/src/models/PersonalAccessToken'

describe('revokeToken() synchronous eviction', () => {
  it('waits for lookupCache.invalidate to resolve', async () => {
    const mockInvalidate = vi.fn(() => Promise.resolve(true))
    _setLookupCacheForTests({ invalidate: mockInvalidate })
    // stub DB update to return a result with hashPrefix
    const stub = vi.spyOn(PATModel, 'findOneAndUpdate').mockResolvedValue({ _id: 'tok-1', hashPrefix: 'abcd1234', userId: 'u1' })
    await PAM.revokeToken('u1', 'tok-1')
    expect(mockInvalidate).toHaveBeenCalled()
    stub.mockRestore()
  })
})
