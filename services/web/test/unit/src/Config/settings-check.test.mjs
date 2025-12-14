import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('settings-check module', () => {
  const OLD_ENV = { ...process.env }
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...OLD_ENV }
  })
  afterEach(() => {
    process.env = OLD_ENV
    vi.restoreAllMocks()
  })

  it('does not throw when validation passes', async () => {
    process.env.FEATURE_GIT_AUTH_LOCAL_TOKEN_MANAGER = 'true'
    process.env.AUTH_TOKEN_HASH_ALGO = 'argon2id'
    process.env.AUTH_TOKEN_ARGON2_TIME = '1'
    process.env.AUTH_TOKEN_ARGON2_MEMORY_KB = '32'
    process.env.AUTH_TOKEN_ARGON2_PARALLELISM = '1'
    process.env.AUTH_TOKEN_BCRYPT_COST = '4'
    process.env.CACHE_LOOKUP_TTL_SECONDS = '60'
    process.env.CACHE_NEGATIVE_TTL_SECONDS = '10'
    vi.mock('../../../../app/src/config/hashAvailability.mjs', () => ({ default: vi.fn(() => true) }))
    let thrown = null
    try {
      await import('../../../../modules/settings-check/index.mjs')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeNull()
  })
})