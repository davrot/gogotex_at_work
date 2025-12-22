import UserHelper from '../contract/../acceptance/src/helpers/UserHelper.mjs'

async function run() {
  const user = await UserHelper.createUser({ password: 'Password-123!' })
  await UserHelper.loginUser({ email: user.email, password: 'Password-123!' })
  const { response, body } = await user.doRequest('post', { url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'debug-revoke' } })
  console.log('[repro_revoke] create status', response.statusCode, body)
  const token = body && (body.plaintext || body.token)

  const revoke = await user.doRequest('delete', { url: `/internal/api/users/${user.id}/git-tokens/${body.id}` })
  console.log('[repro_revoke] revoke status', revoke.response && revoke.response.statusCode, revoke.body)

  const intros = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
  console.log('[repro_revoke] introspect status', intros.response && intros.response.statusCode, intros.body)
}

run().catch(err => { console.error(err && (err.stack || err)); process.exit(1) })
