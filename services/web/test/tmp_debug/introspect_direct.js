import PersonalAccessTokenManager from '../../app/src/Features/Token/PersonalAccessTokenManager.mjs'

async function run() {
  try {
    const res = await PersonalAccessTokenManager.introspect('bad-1')
    console.log('introspect result:', res)
  } catch (err) {
    console.error('introspect threw:', err)
  }
}
run()
