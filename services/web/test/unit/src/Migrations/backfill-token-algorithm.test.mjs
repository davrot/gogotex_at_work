import { expect } from 'chai'
import sinon from 'sinon'
import * as Migration from '../../../../migrations/backfill-token-algorithm.js'

describe('backfill-token-algorithm migration', function () {
  it('dryRun counts tokens missing algorithm', async function () {
    const fakeDb = { personal_access_tokens: { countDocuments: sinon.stub().resolves(3) } }
    const count = await Migration.dryRun(fakeDb)
    expect(count).to.equal(3)
  })

  it('migrate updates algorithm field based on hash content', async function () {
    const docs = [
      { _id: 'a', hash: '$argon2id$whatever' },
      { _id: 'b', hash: '$2b$12$abcd' },
      { _id: 'c', hash: 'unknown' },
    ]
    const cursor = {
      idx: 0,
      async hasNext() { return this.idx < docs.length },
      async next() { return docs[this.idx++] }
    }
    const fakeDb = {
      personal_access_tokens: {
        find: sinon.stub().returns(cursor),
        updateOne: sinon.stub().resolves({ modifiedCount: 1 }),
      }
    }
    await Migration.migrate(fakeDb)
    // verify updateOne called 3 times
    const called = fakeDb.personal_access_tokens.updateOne.callCount
    expect(called).to.equal(3)
  })
})
