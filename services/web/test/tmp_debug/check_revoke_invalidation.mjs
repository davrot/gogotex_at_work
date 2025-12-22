import { createRequire } from 'module'
import PAM, { _setLookupCacheForTests } from '../../app/src/Features/Token/PersonalAccessTokenManager.mjs'
const require = createRequire(import.meta.url)
const PAT = require('../../app/src/models/PersonalAccessToken.js')

let called = false
_setLookupCacheForTests({ invalidate: async (k) => { console.log('invalidate called key=', k); called = true } })

// stub model
PAT.PersonalAccessToken.findOneAndUpdate = async (query, update) => ({ _id: query._id || 'tok-1', hashPrefix: 'abcd1234', userId: query.userId || 'u1' })
// force local path
process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'false'

;(async () => {
  const ok = await PAM.revokeToken('u1','tok-1')
  console.log('revoke returned', ok, 'called=', called)
})().catch(e => console.error(e && e.stack))
