import mongoose from 'mongoose'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import crypto from 'node:crypto'

const USAGE = `Usage: node tools/seed_ssh_key.mjs <userId> <pubkey-file>
Reads the public key file and inserts a UserSSHKey document into sharelatex.usersshkeys (dev only).`

if (process.argv.length < 4) {
  console.error(USAGE)
  process.exit(2)
}

const userId = process.argv[2]
const pubkeyFile = process.argv[3]

if (!fs.existsSync(pubkeyFile)) {
  console.error('Public key file not found:', pubkeyFile)
  process.exit(2)
}

const pub = fs.readFileSync(pubkeyFile, 'utf8').trim()

if (!pub) {
  console.error('Public key file is empty')
  process.exit(2)
}

// Compute fingerprint locally like the server does
function computeFingerprint(publicKey) {
  try {
    const parts = publicKey.trim().split(/\s+/)
    if (parts.length < 2) return null
    const keyData = parts[1]
    const buf = Buffer.from(keyData, 'base64')
    const digest = crypto.createHash('sha256').update(buf).digest('base64')
    return `SHA256:${digest}`
  } catch (e) {
    return null
  }
}

const fingerprint = (function () {
  try {
    const parts = pub.trim().split(/\s+/)
    const keyData = parts[1]
    const buf = Buffer.from(keyData, 'base64')
    const digest = crypto.createHash('sha256').update(buf).digest('base64')
    return `SHA256:${digest}`
  } catch (e) {
    console.error('Failed to compute fingerprint', e)
    process.exit(1)
  }
})()

const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/sharelatex'

try {
  await mongoose.connect(mongoUri, { dbName: 'sharelatex' })
  const UserSSHKey = new mongoose.Schema({ userId: String, keyName: String, publicKey: String, fingerprint: String, createdAt: Date, updatedAt: Date })
  const Model = mongoose.model('UserSSHKey', UserSSHKey, 'usersshkeys')

  const now = new Date()
  const doc = {
    userId,
    keyName: 'e2e-test-key',
    publicKey: pub,
    fingerprint,
    createdAt: now,
    updatedAt: now,
  }

  // upsert by fingerprint
  const res = await Model.findOneAndUpdate({ fingerprint }, doc, { upsert: true, new: true, setDefaultsOnInsert: true })
  console.log('Inserted/updated SSH key with fingerprint', res.fingerprint, 'for user', res.userId)
  await mongoose.disconnect()
  process.exit(0)
} catch (e) {
  console.error('Error inserting SSH key into Mongo:', e && e.stack ? e.stack : e)
  try { await mongoose.disconnect() } catch (er) {}
  process.exit(1)
}
