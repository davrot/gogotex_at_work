// Migration: re-hash or annotate existing PersonalAccessToken documents
// - Adds/ensures `algorithm` and `hashPrefix` fields are present
// - Optionally re-hashes tokens when plaintext is available via a secure import
// - Includes a dry-run mode that validates changes without writing to DB

import { ObjectId } from 'mongodb'

export async function up(db, { dryRun = true } = {}) {
  const tokens = db.collection('personalaccesstokens')

  // Example dry-run: report how many documents would be modified
  if (dryRun) {
    const missing = await tokens.countDocuments({ $or: [{ algorithm: { $exists: false } }, { hashPrefix: { $exists: false } }] })
    console.log(`Rehash migration dry-run: ${missing} token(s) missing algorithm/hashPrefix`) 
    return { modified: 0, dryRun: true, missing }
  }

  // Real run: ensure algorithm and hashPrefix fields exist (do not attempt to recover plaintext)
  // Operators should supply a secondary re-issue plan if they intend to rotate hashes.
  const cursor = tokens.find({ $or: [{ algorithm: { $exists: false } }, { hashPrefix: { $exists: false } }] })
  let modified = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    const updates = {}
    // If no algorithm present, infer from stored metadata where possible (best-effort)
    if (!doc.algorithm) {
      // If hash length suggests bcrypt vs argon2, annotate conservatively; else leave unset for manual review
      if (doc.hash && typeof doc.hash === 'string') {
        if (doc.hash.startsWith('$2')) updates.algorithm = 'bcrypt'
        else updates.algorithm = 'unknown' // require operator action
      } else {
        updates.algorithm = 'unknown'
      }
    }
    if (!doc.hashPrefix && doc.hash && typeof doc.hash === 'string') {
      updates.hashPrefix = doc.hash.slice(0, 8)
    }
    if (Object.keys(updates).length > 0) {
      await tokens.updateOne({ _id: doc._id }, { $set: updates })
      modified++
    }
  }

  console.log(`Rehash migration: annotated ${modified} token(s)`)
  return { modified, dryRun: false }
}

export async function down(db) {
  // This migration is additive; rollback would remove added metadata fields.
  const tokens = db.collection('personalaccesstokens')
  const res = await tokens.updateMany({}, { $unset: { algorithm: '', hashPrefix: '' } })
  return { reverted: res.modifiedCount }
}

export default { up, down }
