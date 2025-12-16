import UserHelper from '../contract/../acceptance/src/helpers/UserHelper.mjs'
import Settings from '@overleaf/settings'

async function run() {
  // Use admin basic auth to call introspect with a bad token
  const user = await UserHelper.createUser({ password: 'Password-123!' })
  const adminUser = process.env.WEB_API_USER || 'overleaf'
  const adminPass = process.env.WEB_API_PASSWORD || 'overleaf'
  const res = await user.doRequest('post', { url: '/internal/api/tokens/introspect', json: { token: 'bad-1' }, auth: { user: adminUser, pass: adminPass, sendImmediately: true }, jar: false })
  console.log('status', res.response.statusCode, 'body', res.body)
}

run().catch(err => { console.error(err); process.exit(1) })