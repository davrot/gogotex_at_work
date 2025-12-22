import PersonalAccessTokenManager from '../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
import mongoose from 'mongoose'

async function run() {
  // create a temp user id that looks like ObjectId
  const userId = new mongoose.Types.ObjectId().toString()
  console.log('calling createToken for userId', userId)
  try {
    const res = await PersonalAccessTokenManager.createToken(userId, { label: 'debug' })
    console.log('createToken result:', res)
  } catch (e) {
    console.error('createToken threw:', e && (e.stack || e))
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })