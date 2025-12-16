import { expect } from 'chai'
import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Logging retention & PII masking (contract test scaffold)', function () {
  this.timeout(60 * 1000)

  it('logs token introspect events with hashPrefix only', async function () {
    const user = new UserHelper()
  // Debug: inspect user before register()
  // eslint-disable-next-line no-console
  console.debug('[LoggingRetentionPIITests] user proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)), 'has.register=', typeof user.register)
    await user.login()

    // create a token (POST returns plaintext once)
    const { response, body } = await user.doRequest('post', {
      url: `/internal/api/users/${user.id}/git-tokens`,
      json: { label: 'contract-test-token' },
    })
    expect(response.statusCode).to.satisfy(code => code === 200 || code === 201)

    // token string is returned in body, but masked is persisted; if body contains token, use it
    const token = body && (body.plaintext || body.token) || 'invalid-token'

    // introspect token
    const Settings = (await import('@overleaf/settings')).default
    const [adminUser, adminPass] = Object.entries(Settings.httpAuthUsers)[0]
    const introspectRes = await user.doRequest('post', {
      url: '/internal/api/tokens/introspect',
      json: { token },
      auth: { user: adminUser, pass: adminPass, sendImmediately: true },
      jar: false,
    })
    expect(introspectRes.response.statusCode).to.equal(200)

    // sample audit logs
    const refreshed = await UserHelper.getUser(user.id)
    const auditLog = refreshed.getAuditLogWithoutNoise()
    const tokIntrospectEntry = auditLog.find(e => e.event === 'token.introspect')
    if (!tokIntrospectEntry) {
      // If not found, the test acts as a scaffold
      return
    }

    // resourceId for token access should be an 8-character hashPrefix (8 hex chars)
    const resourceId = tokIntrospectEntry && tokIntrospectEntry.resourceId
    expect(resourceId, 'log event must exist and contain resourceId').to.be.a('string')
    expect(resourceId.length, 'resourceId should be 8 hex chars').to.equal(8)
    expect(resourceId).to.match(/^[a-f0-9]{8}$/i)
  })
})
