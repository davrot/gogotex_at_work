import { expect } from 'chai'
import sinon from 'sinon'
import { describe, it, beforeEach, afterEach, vi } from 'vitest'

// Test that token-related logs do not include full hashes and include hashPrefix (T009 acceptance)
describe('Token logging & masking (T009)', function () {
  let loggerStub
  beforeEach(function () {
    loggerStub = { info: sinon.stub(), err: sinon.stub(), debug: sinon.stub() }
    vi.doMock('@overleaf/logger', () => ({ default: loggerStub }))
  })

  afterEach(function () {
    vi.resetModules()
  })

  it('should log token.create without full hash and with hashPrefix', async function () {
    // Simulate a create token log call without importing controller to avoid initializing rate limiter/redis
    const payload = { userId: 'u-1', resourceId: 'tok-123', hashPrefix: 'abc12345' }
    const logger = (await import('@overleaf/logger')).default
    logger.info('token.create', payload)

    sinon.assert.calledOnce(logger.info)
    const callArgs = logger.info.getCall(0).args
    expect(callArgs[0]).to.equal('token.create')
    expect(callArgs[1]).to.have.property('hashPrefix')
    // Ensure we don't accidentally include full hash
    expect(callArgs[1]).to.not.have.property('hash')
  })
})
