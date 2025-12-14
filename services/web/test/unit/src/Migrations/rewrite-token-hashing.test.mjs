import { expect } from 'chai'
import sinon from 'sinon'
import * as Migration from '../../../../migrations/rewrite-token-hashing.js'

describe('rewrite-token-hashing migration', function () {
  it('dryRun counts tokens using old algorithm', async function () {
    const fakeDb = { personal_access_tokens: { countDocuments: sinon.stub().resolves(3) } }
    const count = await Migration.dryRun('bcrypt', 'argon2id', fakeDb)
    expect(count).to.equal(3)
  })

  it('migrate reissues tokens, creates reissue docs and revokes old tokens', async function () {
    const oldTokens = [
      { _id: 't1', userId: 'u1', label: 'l1', scopes: [], expiresAt: null, algorithm: 'bcrypt', active: true },
      { _id: 't2', userId: 'u2', label: 'l2', scopes: ['read'], expiresAt: null, algorithm: 'bcrypt', active: true },
    ]

    // fake cursor
    let idx = 0
    const cursor = {
      async hasNext() { return idx < oldTokens.length },
      async next() { return oldTokens[idx++] }
    }

    const insertOneStub = sinon.stub().resolves()
    const updateOneStub = sinon.stub().resolves()
    const fakeDb = {
      personal_access_tokens: { find: sinon.stub().returns(cursor), updateOne: updateOneStub },
      personal_access_token_reissues: { insertOne: insertOneStub }
    }

    // Stub a createToken function
    const createTokenStub = sinon.stub().resolves({ token: 'plain-new', id: 'newid' })

    // Set a minimal encryptor config so AccessTokenEncryptor can be constructed
    process.env.ACCESS_TOKEN_CIPHER_PASSWORDS = JSON.stringify({ 'reissue-v3': '01234567890123456789012345678901' })

    // Now run migration and inject createTokenFn
    const reissued = await Migration.migrate('bcrypt', 'argon2id', fakeDb, { chunkSize: 2, reissueTTLDays: 1, notify: false, createTokenFn: createTokenStub })

    expect(reissued).to.equal(2)
    expect(createTokenStub.callCount).to.equal(2)
    expect(insertOneStub.callCount).to.equal(2)
    expect(updateOneStub.callCount).to.equal(2)

  })
})
