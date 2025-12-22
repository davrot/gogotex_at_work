import UserHelper from '../acceptance/src/helpers/UserHelper.mjs'
import PersonalAccessTokenManager from '../../app/src/Features/Token/PersonalAccessTokenManager.mjs'

async function run() {
  const user = await UserHelper.createUser({ password: 'Password-123!' })
  console.log('created user:', user.email, user.id)
  await UserHelper.loginUser({ email: user.email, password: 'Password-123!' })
  try {
    const res = await PersonalAccessTokenManager.createToken(user.id, { label: 'debug' })
    console.log('direct manager create result', res)
  } catch (e) {
    console.error('direct manager create threw', e && (e.stack || e))
  }
}

run().catch(err => { console.error(err); process.exit(1) })