import { db as defaultDb } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'

export async function dryRun(dbParam = defaultDb) {
  // count tokens without hashPrefix and keys without fingerprint
  const tMissing = await dbParam.personal_access_tokens.countDocuments({ hashPrefix: { $exists: false } })
  const kMissing = await dbParam.user_ssh_keys.countDocuments({ fingerprint: { $exists: false } })
  console.log(`Dry-run: ${tMissing} tokens missing hashPrefix, ${kMissing} ssh-keys missing fingerprint`)
  return { tokensMissing: tMissing, sshKeysMissing: kMissing }
}

export async function migrate(dbParam = defaultDb) {
  // Create indexes for fast lookups and uniqueness guarantees
  const tokenIndex = await dbParam.personal_access_tokens.createIndex({ hashPrefix: 1 })
  const sshIndex = await dbParam.user_ssh_keys.createIndex({ fingerprint: 1 }, { unique: true, sparse: true })
  console.log('Created indexes:', { tokenIndex, sshIndex })
  return { tokenIndex, sshIndex }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, mode] = process.argv
  if (!mode) { console.error('Usage: node create-key-token-indexes.js <dryrun|migrate>'); process.exit(1) }
  if (mode === 'dryrun') dryRun().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  if (mode === 'migrate') migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
}
