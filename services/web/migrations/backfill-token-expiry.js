// Placeholder migration to set expiresAt default on tokens without expiry

import { db as defaultDb } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'

export async function dryRun(defaultDays = 90, dbParam = defaultDb) {
  const query = { expiresAt: { $exists: false } }
  const count = await dbParam.personal_access_tokens.countDocuments(query)
  console.log(`Dry-run: ${count} tokens would be assigned expiresAt=${defaultDays} days from now`)
  return count
}

export async function migrate(defaultDays = 90, dbParam = defaultDb) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + defaultDays * 24 * 60 * 60 * 1000)
  const res = await dbParam.personal_access_tokens.updateMany(
    { expiresAt: { $exists: false } },
    { $set: { expiresAt } }
  )
  console.log(`Updated ${res.modifiedCount} tokens`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, mode, days] = process.argv
  const defaultDays = parseInt(days || '90', 10)
  if (!mode) {
    console.error('Usage: node backfill-token-expiry.js <dryrun|migrate> [days]')
    process.exit(1)
  }
  if (mode === 'dryrun') {
    dryRun(defaultDays).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  } else if (mode === 'migrate') {
    migrate(defaultDays).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  }
}
