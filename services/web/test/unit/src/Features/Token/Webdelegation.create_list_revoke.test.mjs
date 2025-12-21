import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('WebProfile delegation (create/list/revoke)', () => {
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

  it('delegates createToken to WebProfileClient', async () => {
    // stub fetch for POST
    vi.stubGlobal('fetch', async (url, opts) => ({
      status: 201,
      async json() { return { token: 'tkn', id: 'r1', accessTokenPartial: 'abcd1234' } }
    }))
    const PAM = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    const res = await PAM.default.createToken('69475e1ac65798f7cab0c5f7', { label: 'x' })
    expect(res).toEqual({ token: 'tkn', id: 'r1', hashPrefix: 'abcd1234', createdAt: null, expiresAt: null })
  })

  it('delegates listTokens to WebProfileClient', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({
      status: 200,
      async json() { return [{ id: 'r1', label: 'lab', scopes: [], active: true, hashPrefix: 'abcd' }] }
    }))
    const PAM = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    const res = await PAM.default.listTokens('69475e1ac65798f7cab0c5f7')
    expect(res).toEqual([{ id: 'r1', label: 'lab', scopes: [], active: true, hashPrefix: 'abcd', createdAt: null, expiresAt: null }])
  })

  it('delegates revokeToken to WebProfileClient', async () => {
    vi.stubGlobal('fetch', async (url, opts) => ({ status: 204 }))
    const PAM = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    const ok = await PAM.default.revokeToken('69475e1ac65798f7cab0c5f7', '6947656db52459af4ffdc640')
    expect(ok).toEqual(true)
  })
})
