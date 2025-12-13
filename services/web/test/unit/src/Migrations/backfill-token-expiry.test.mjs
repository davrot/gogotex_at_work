import { expect } from 'chai'
import sinon from 'sinon'
import * as Migration from '../../../../migrations/backfill-token-expiry.js'

describe('backfill-token-expiry migration', function () {
  it('dryRun counts tokens missing expiresAt', async function () {
    const fakeDb = { personal_access_tokens: { countDocuments: sinon.stub().resolves(5) } }
    const count = await Migration.dryRun(90, fakeDb)
    expect(count).to.equal(5)
  })

  it('migrate updates tokens with expiresAt', async function () {
    const fakeDb = {
      personal_access_tokens: {
        updateMany: sinon.stub().resolves({ modifiedCount: 2 })
      }
    }
    await Migration.migrate(90, fakeDb)
    expect(fakeDb.personal_access_tokens.updateMany.callCount).to.equal(1)
  })
})
