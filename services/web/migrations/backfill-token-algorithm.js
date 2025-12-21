// Migration: Detect and set the `algorithm` field on PersonalAccessToken documents

import { db as defaultDb } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'

export async function dryRun(dbParam = defaultDb) {
  const query = { algorithm: { $exists: false } }
  const count = await dbParam.personal_access_tokens.countDocuments(query)
  console.log(`Dry-run: ${count} tokens missing algorithm field`)
  return count
}

export async function migrate(dbParam = defaultDb) {
  const cursor = dbParam.personal_access_tokens.find({ algorithm: { $exists: false } }, { projection: { _id: 1, hash: 1 }})
  let updated = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    const { _id, hash } = doc
    let algo = 'unknown'
    if (typeof hash === 'string') {
      if (hash.startsWith('$argon2id$') || hash.startsWith('$argon2i$') || hash.startsWith('$argon2$')) algo = 'argon2id'
      else if (/^\$2[aby]\$/.test(hash)) algo = 'bcrypt'
    }
    const res = await dbParam.personal_access_tokens.updateOne({ _id }, { $set: { algorithm: algo } })
    if (res.modifiedCount === 1) updated++
  }
  console.log(`Updated algorithm field for ${updated} tokens`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, mode] = process.argv
  if (!mode) { console.error('Usage: node backfill-token-algorithm.js <dryrun|migrate>'); process.exit(1) }
  if (mode === 'dryrun') dryRun().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  if (mode === 'migrate') migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
}
