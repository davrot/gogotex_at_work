import UserHelper from '../contract/../acceptance/src/helpers/UserHelper.mjs'

async function run() {
  const user = await UserHelper.createUser({ password: 'Password-123!' })
  await UserHelper.loginUser({ email: user.email, password: 'Password-123!' })
  const { response, body } = await user.doRequest('post', { url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'debug-introspect' } })
  console.log('create token status', response.statusCode, body)
  const token = body && (body.plaintext || body.token)
  const intros = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token } })
  console.log('introspect status', intros.response.statusCode, intros.body)
}

run().catch(err => { console.error(err); process.exit(1) })