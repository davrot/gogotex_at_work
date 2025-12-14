import { expect } from 'chai'
import { beforeAll, afterAll } from 'vitest'
import * as PAMod from '../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
const PersonalAccessTokenManager = PAMod.default || PAMod

describe('PersonalAccessToken rotation behavior', function () {
  beforeAll(async function () { /* DB connection provided by test harness; skip if not present */ })
  afterAll(async function () { /* cleanup handled by test harness */ })

  it('revokes previous token when replace=true', async function () {
    // Ensure we use bcrypt to avoid argon2 availability issues in CI/dev images
    process.env.AUTH_TOKEN_HASH_ALGO = 'bcrypt'
    const userId = 'u-rot-1'
    const res1 = await PersonalAccessTokenManager.createToken(userId, { label: 'rot-label' })
    expect(res1).to.have.property('token')
    const res2 = await PersonalAccessTokenManager.createToken(userId, { label: 'rot-label', replace: true })
    expect(res2).to.have.property('token')
    // introspect original token - it should be inactive
    const info1 = await PersonalAccessTokenManager.introspect(res1.token)
    expect(info1 && info1.active).to.be.false
    // introspect new token - it should be active
    const info2 = await PersonalAccessTokenManager.introspect(res2.token)
    expect(info2 && info2.active).to.be.true
  })
})
