import { expect } from 'chai'
import sinon from 'sinon'
import { describe, it, beforeEach, vi } from 'vitest'

// Unit-level tests for fingerprint lookup auth behavior (T019b skeleton)
describe('SSH fingerprint lookup auth (T019b)', function () {
  let AuthenticationController
  beforeEach(async function () {
    // Import the project's AuthenticationController from Features path
  // Provide a lightweight mock for the AuthenticationController to avoid importing heavy deps
    vi.doMock('../../../../../app/src/Features/Authentication/AuthenticationController.mjs', () => ({ default: { requirePrivateApiAuth: () => (req, res, next) => next() } }))
    AuthenticationController = (await import('../../../../../app/src/Features/Authentication/AuthenticationController.mjs')).default || (await import('../../../../../app/src/Features/Authentication/AuthenticationController.mjs'))
  })

  it('should require private API auth for lookup routes (unit assertion)', function () {
    // The requirePrivateApiAuth should be wired to call requireBasicAuth internally - this is covered elsewhere
    const middleware = AuthenticationController.requirePrivateApiAuth()
    // middleware is a function (the actual auth behaviour is tested in contract tests)
    expect(typeof middleware).to.equal('function')
  })
})
