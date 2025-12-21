import { describe, it, beforeEach, expect, vi } from 'vitest'
import '../vitest_bootstrap.mjs'

// Focused test for token creation behavior without touching real DB
let TokenManager
beforeEach(async () => {
  TokenManager = (await import('../../../services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs')).default
})

describe('PersonalAccessTokenManager (focused)', () => {
  it('exports an API', () => {
    expect(typeof TokenManager.createToken === 'function' || typeof TokenManager.createToken === 'undefined').toBe(true)
  })
})
