import UserHelper from '../contract/../acceptance/src/helpers/UserHelper.mjs'

async function run() {
  const user = await UserHelper.createUser({ password: 'Password-123!' })
  console.log('created user:', user.email, user.id)
  // ensure logged in
  await UserHelper.loginUser({ email: user.email, password: 'Password-123!' })
  const res = await user.doRequest('post', { url: `/internal/api/users/${user.id}/git-tokens`, json: { label: 'debug' } })
  console.log('create token status', res.response.statusCode, 'body', res.body)
}

run().catch(err => { console.error(err); process.exit(1) })
