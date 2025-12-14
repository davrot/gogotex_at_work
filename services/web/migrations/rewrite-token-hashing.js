// Placeholder migration script for re-hashing tokens when algorithm changes
// This script should be safe in dry-run mode and report affected rows without mutating data

import { db as defaultDb } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'

export async function dryRun(oldAlgo, newAlgo, dbParam = defaultDb) {
  const query = { algorithm: oldAlgo }
  const count = await dbParam.personal_access_tokens.countDocuments(query)
  console.log(`Dry-run: ${count} tokens with algorithm ${oldAlgo} would be considered for migration to ${newAlgo}`)
  return count
}

import AccessTokenEncryptor from '../../../libraries/access-token-encryptor/index.js'
import PersonalAccessTokenManager from '../app/src/Features/Token/PersonalAccessTokenManager.mjs'

export async function migrate(oldAlgo, newAlgo, dbParam = defaultDb, opts = { chunkSize: 100, reissueTTLDays: 7, notify: false }) {
  if (oldAlgo === newAlgo) {
    console.log('Old and new algorithms are identical; nothing to do')
    return 0
  }
  const { chunkSize, reissueTTLDays, notify, createTokenFn = (u, o) => PersonalAccessTokenManager.createToken(u, o) } = opts

  const cursor = dbParam.personal_access_tokens.find({ algorithm: oldAlgo, active: true }, { projection: { _id: 1, userId: 1, label: 1, scopes: 1, expiresAt: 1 }})
  let reissued = 0

  // Load encryptor settings from env or defaults
  const cipherPasswords = process.env.ACCESS_TOKEN_CIPHER_PASSWORDS ? JSON.parse(process.env.ACCESS_TOKEN_CIPHER_PASSWORDS) : { 'reissue-v3': (process.env.ACCESS_TOKEN_REISSUE_PASSWORD || 'reissue-password-should-be-set') }
  const accessTokenEncryptor = new AccessTokenEncryptor({ cipherPasswords, cipherLabel: Object.keys(cipherPasswords)[0] })

  while (await cursor.hasNext()) {
    const batch = []
    for (let i = 0; i < chunkSize && await cursor.hasNext(); i++) {
      const doc = await cursor.next()
      batch.push(doc)
    }
    for (const t of batch) {
      // Generate a new token under the new algorithm
      const prevEnvAlgo = process.env.AUTH_TOKEN_HASH_ALGO
      process.env.AUTH_TOKEN_HASH_ALGO = newAlgo
      let newToken
      try {
        newToken = await createTokenFn(t.userId, { label: t.label, scopes: t.scopes, expiresAt: t.expiresAt })
      } catch (e) {
        // if create fails, skip and log
        try { console.error('Failed to create new token for', t._id, e) } catch (ie) {}
        process.env.AUTH_TOKEN_HASH_ALGO = prevEnvAlgo
        continue
      }
      process.env.AUTH_TOKEN_HASH_ALGO = prevEnvAlgo

      // Encrypt the new plaintext token for secure short-term storage
      const encrypted = await accessTokenEncryptor.promises.encryptJson({ token: newToken.token })
      const reissueDoc = {
        userId: t.userId,
        oldTokenId: t._id,
        newTokenId: newToken.id,
        encryptedSecret: encrypted,
        expiresAt: new Date(Date.now() + (reissueTTLDays * 24 * 60 * 60 * 1000)),
        createdAt: new Date(),
        delivered: false,
      }
      await dbParam.personal_access_token_reissues.insertOne(reissueDoc)

      // Revoke the old token and set metadata
      await dbParam.personal_access_tokens.updateOne({ _id: t._id }, { $set: { active: false, replacedBy: newToken.id, reissuedAt: new Date(), algorithm: newAlgo } })

      // Optionally publish an event for admin notification or async delivery
      if (notify) {
        try {
          const pub = require('../app/src/lib/pubsub')
          pub.publish('auth.token.reissued', { userId: t.userId, oldTokenId: t._id.toString(), newTokenId: newToken.id })
        } catch (e) {
          // swallow
        }
      }
      reissued++
    }
  }
  console.log(`Reissued ${reissued} tokens from ${oldAlgo} to ${newAlgo}`)
  return reissued
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, mode, oldAlgo, newAlgo, chunkSize, notifyFlag] = process.argv
  if (!mode || !oldAlgo || !newAlgo) {
    console.error('Usage: node rewrite-token-hashing.js <dryrun|migrate> <oldAlgo> <newAlgo> [chunkSize] [notify=true]')
    process.exit(1)
  }
  const chunk = parseInt(chunkSize || '100', 10)
  const notify = notifyFlag === 'true' || notifyFlag === '1'
  if (mode === 'dryrun') {
    dryRun(oldAlgo, newAlgo).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  } else if (mode === 'migrate') {
    migrate(oldAlgo, newAlgo, defaultDb, { chunkSize: chunk, reissueTTLDays: 7, notify }).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  }
}
