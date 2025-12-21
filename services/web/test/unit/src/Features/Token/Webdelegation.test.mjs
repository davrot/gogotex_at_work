import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('WebProfile delegation', () => {
  let origEnv
  beforeEach(() => {
    origEnv = process.env.AUTH_TOKEN_USE_WEBPROFILE_API
    process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'true'
  })
  afterEach(() => {
    if (origEnv === undefined) delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
    else process.env.AUTH_TOKEN_USE_WEBPROFILE_API = origEnv
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('delegates introspect to WebProfileClient', async () => {
    // stub global fetch used by WebProfileClient
    const mockRes = { active: true, userId: 'u1', scopes: [] }
    vi.stubGlobal('fetch', async (url, opts) => ({
      status: 200,
      async json() { return mockRes }
    }))
    const PAM = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    const res = await PAM.default.introspect('delegated-token')
    expect(res).toEqual(mockRes)
  })
})
