import { UserSSHKey } from '../../../models/UserSSHKey.js'
import { User } from '../../../models/User.js'
import { ObjectId } from 'mongoose'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import logger from '@overleaf/logger'

function _computeFingerprint(publicKey) {
  // publicKey expected in OpenSSH format: "ssh-rsa AAAAB3Nza... [comment]"
  try {
    const parts = publicKey.trim().split(/\s+/)
    if (parts.length < 2) return null
    const keyData = parts[1]
    const buf = Buffer.from(keyData, 'base64')
    const digest = crypto.createHash('sha256').update(buf).digest('base64')
    // Use SHA256:... style to be explicit
    return `SHA256:${digest}`
  } catch (err) {
    logger.warn({ err }, 'failed to compute ssh key fingerprint')
    return null
  }
}

export async function list(req, res) {
  const userId = req.params.userId
  const criteria = { userId }
  try {
    const keys = await UserSSHKey.find(criteria).lean().exec()
    // Enrich keys with user metadata: username (email) and display_name
    const user = await User.findById(userId).lean().exec()
    const username = user && user.email ? user.email : null
    const displayName = user
      ? `${user.first_name || ''}${user.first_name && user.last_name ? ' ' : ''}${user.last_name || ''}`.trim() || null
      : null
    const enriched = keys.map(k => ({
      id: String(k._id || k.id),
      key_name: k.keyName || k.key_name || '',
      public_key: k.publicKey || k.public_key || '',
      fingerprint: k.fingerprint || '',
      created_at: k.createdAt || k.created_at || null,
      updated_at: k.updatedAt || k.updated_at || null,
      userId: k.userId || k.user_id || userId,
      username,
      display_name: displayName,
    }))
    // Return a top-level JSON array to match WebProfileClient expectations
    return res.status(200).json(enriched)
  } catch (err) {
    logger.err({ err, userId }, 'error listing user ssh keys')
    return res.sendStatus(500)
  }
}

export async function create(req, res) {
  const userId = req.params.userId
  const { key_name: keyName, public_key: publicKey } = req.body
  if (!publicKey || !publicKey.trim()) {
    return res.status(400).json({ message: 'public_key required' })
  }
  // Basic server-side validation of OpenSSH public key format
  const re = /^ssh-(rsa|ed25519|ecdsa) [A-Za-z0-9+/=]+(?: .*)?$/
  if (!re.test(publicKey.trim())) {
    return res.status(400).json({ message: 'invalid public_key format' })
  }
  try {
    const fingerprint = _computeFingerprint(publicKey) || ''
    const doc = new UserSSHKey({
      userId,
      keyName: keyName || '',
      publicKey,
      fingerprint,
    })
    await doc.save()
    // include user metadata
    const user = await User.findById(userId).lean().exec()
    const username = user && user.email ? user.email : null
    const displayName = user
      ? `${user.first_name || ''}${user.first_name && user.last_name ? ' ' : ''}${user.last_name || ''}`.trim() || null
      : null
    try { logger.info({ type: 'sshkey.added', userId, keyId: String(doc._id), fingerprint: doc.fingerprint, timestamp: new Date().toISOString() }) } catch (e) {}
    return res.status(201).json({
      id: String(doc._id),
      key_name: doc.keyName,
      public_key: doc.publicKey,
      fingerprint: doc.fingerprint,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
      userId: userId,
      username,
      display_name: displayName,
    })
  } catch (err) {
    logger.err({ err, userId }, 'error creating user ssh key')
    return res.sendStatus(500)
  }
}

export async function remove(req, res) {
  const userId = req.params.userId
  const keyId = req.params.keyId
  if (!keyId) return res.sendStatus(400)
  try {
    const r = await UserSSHKey.findOneAndDelete({ _id: keyId, userId }).exec()
    if (!r) return res.sendStatus(404)
    try { logger.info({ type: 'sshkey.removed', userId, keyId, timestamp: new Date().toISOString() }) } catch (e) {}
    return res.sendStatus(204)
  } catch (err) {
    logger.err({ err, userId, keyId }, 'error deleting user ssh key')
    return res.sendStatus(500)
  }
}

export default { list, create, remove }
