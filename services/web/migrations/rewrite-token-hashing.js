// Placeholder migration script for re-hashing tokens when algorithm changes
// This script should be safe in dry-run mode and report affected rows without mutating data

import { db } from '../app/src/infrastructure/mongodb.js'

export async function dryRun(oldAlgo, newAlgo) {
  const query = { hashAlgorithm: oldAlgo }
  const count = await db.personal_access_tokens.countDocuments(query)
  console.log(`Dry-run: ${count} tokens with algorithm ${oldAlgo} would be considered for migration to ${newAlgo}`)
  return count
}

export async function migrate(oldAlgo, newAlgo) {
  // Implement re-hash / re-issue strategy: for now we log and require manual intervention
  console.log('Migration not implemented. Please implement a safe re-hash/re-issue algorithm that rotates tokens.')
}

if (require.main === module) {
  const [,, mode, oldAlgo, newAlgo] = process.argv
  if (!mode || !oldAlgo || !newAlgo) {
    console.error('Usage: node rewrite-token-hashing.js <dryrun|migrate> <oldAlgo> <newAlgo>')
    process.exit(1)
  }
  if (mode === 'dryrun') {
    dryRun(oldAlgo, newAlgo).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  } else if (mode === 'migrate') {
    migrate(oldAlgo, newAlgo).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
  }
}
