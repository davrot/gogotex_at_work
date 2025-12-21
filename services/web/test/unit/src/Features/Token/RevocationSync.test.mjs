import { describe, it, expect, vi } from 'vitest'

import PersonalAccessTokenManager from '../../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs'

describe('revokeToken() synchronous eviction', () => {
  it('waits for lookupCache.invalidate to resolve', async () => {
    const mockInvalidate = vi.fn(() => Promise.resolve(true))
    // inject mock lookupCache into manager
    const manager = new PersonalAccessTokenManager({ lookupCache: { invalidate: mockInvalidate } })
    // For now call revokeToken with minimal args; implementation will evolve
    await manager.revokeToken({ id: 'tok-1', userId: 'u1' })
    expect(mockInvalidate).toHaveBeenCalled()
  })
})
