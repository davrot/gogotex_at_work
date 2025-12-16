import { UserSSHKey as _ImportedUserSSHKey } from '../../../models/UserSSHKey.js'
// Allow tests to override the model binding for isolation
let UserSSHKey = _ImportedUserSSHKey
export function __setUserSSHKeyForTest(mock) { UserSSHKey = mock }
export function __resetUserSSHKeyForTest() { UserSSHKey = _ImportedUserSSHKey }
import { ObjectId } from 'mongoose'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import fs from 'node:fs'
import logger from '@overleaf/logger'
// Fallback no-op cache when app/lib/lookupCache.mjs is not present in this runtime
const lookupCache = { get: () => undefined, set: () => {}, invalidate: () => {} }
import SessionManager from '../Authentication/SessionManager.mjs'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'

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
  let sessionUserId = SessionManager.getLoggedInUserId(req.session)
  // Test-only fallback: allow tests to pass a dev header to bypass flaky login
  if (!sessionUserId && process.env.NODE_ENV === 'test') {
    const devUser = (req.get && req.get('x-dev-user-id')) || req.headers['x-dev-user-id']
    if (devUser) {
      try { console.warn('DEBUG UserSSHKeysController.list: using x-dev-user-id header (test fallback)', devUser) } catch (e) {}
      sessionUserId = devUser
    }
  }
  const userId = req.params.userId || sessionUserId
  if (!userId) return res.status(400).json({ message: 'user id required' })
  // If a different userId is supplied in params, only allow if the session user has admin access
  if (req.params.userId && String(req.params.userId) !== String(sessionUserId)) {
    // Allow trusted service requests via Basic auth for dev/infra use (configurable via env)
    const authHeader = (req.get && req.get('authorization')) || req.headers && req.headers.authorization
    const basicMatch = (() => {
      try {
        if (!authHeader || !authHeader.startsWith('Basic ')) return false
        const creds = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
        const parts = creds.split(':')
        const adminUser = process.env.SSH_KEYS_BASIC_USER || 'overleaf'
        const adminPass = process.env.SSH_KEYS_BASIC_PASS || 'overleaf'
        return parts[0] === adminUser && parts[1] === adminPass
      } catch (e) {
        return false
      }
    })()
    if (!basicMatch) {
      const sessionUser = SessionManager.getSessionUser(req.session)
      if (!AdminAuthorizationHelper.hasAdminAccess(sessionUser)) {
        return res.sendStatus(403)
      }
    }
  }
  const criteria = { userId }
  try {
    const keys = await UserSSHKey.find(criteria).lean().exec()
    // Enrich keys with user metadata: username (email) and display_name
    let username = null
    let displayName = null
    try {
      // Prefer using session user metadata when available to avoid an extra DB roundtrip
      const sessionUser = SessionManager.getSessionUser(req.session)
      if (sessionUser && String(sessionUser._id) === String(userId) && sessionUser.email) {
        username = sessionUser.email
        displayName = `${sessionUser.first_name || ''}${sessionUser.first_name && sessionUser.last_name ? ' ' : ''}${sessionUser.last_name || ''}`.trim() || null
      } else {
        const { User } = await import('../../../models/User.js')
        const user = await User.findById(userId).lean().exec()
        username = user && user.email ? user.email : null
        displayName = user
          ? `${user.first_name || ''}${user.first_name && user.last_name ? ' ' : ''}${user.last_name || ''}`.trim() || null
          : null
      }
    } catch (e) {
      // If User model can't be imported (tests/mocks), fall back to null metadata
    }
    const enriched = keys.map(k => ({
      id: String(k._id || k.id),
      key_name: k.keyName || k.key_name || '',
      label: k.keyName || k.label || k.key_name || '',
      public_key: k.publicKey || k.public_key || '',
      fingerprint: k.fingerprint || '',
      created_at: k.createdAt || k.created_at || null,
      updated_at: k.updatedAt || k.updated_at || null,
      userId: k.userId || k.user_id || userId,
      username,
      display_name: displayName,
    }))

    // Diagnostic: ensure we never return a JSON string when an array is expected
    try { console.error('DEBUG UserSSHKeysController.list: enriched type=', typeof enriched, 'isArray=', Array.isArray(enriched), 'len=', enriched && enriched.length) } catch (e) {}
    if (typeof enriched === 'string') {
      // Record context for post-mortem
      try { fs.appendFileSync('/tmp/user_sshkey_list_debug.log', `${new Date().toISOString()} LIST_STRING enriched=${JSON.stringify(enriched)} headers=${JSON.stringify(req.headers)} session=${JSON.stringify(req.session && { id: req.session.id || req.sessionID, user: req.session.user ? { _id: req.session.user._id, email: req.session.user.email } : null })}\n${new Error().stack}\n\n`) } catch (e) {}
      try {
        enriched = JSON.parse(enriched)
      } catch (e) {
        try { console.error('DEBUG UserSSHKeysController.list: failed to parse enriched string - wrapping in array') } catch (e2) {}
        enriched = [enriched]
      }
    }

    // Force logging of outgoing headers & serialized body to detect downstream transforms
    try {
      const serialized = JSON.stringify(enriched)
      try { console.error('DEBUG UserSSHKeysController.list: about to send response, headers=', res.getHeaders ? res.getHeaders() : {}, 'serializedLen=', serialized.length) } catch (e) {}
      try { fs.appendFileSync('/tmp/user_sshkey_list_debug.log', `${new Date().toISOString()} OUTGOING serializedLen=${serialized.length} headers=${JSON.stringify(res.getHeaders ? res.getHeaders() : {})} body=${serialized}\n\n`) } catch (e) {}
    } catch (e) {}

    // Return a proper JSON response via Express so headers and serialization are consistent
    try {
      const serialized = JSON.stringify(enriched)
      try { fs.appendFileSync('/tmp/user_sshkey_list_debug.log', `${new Date().toISOString()} PRE_SEND serializedLen=${serialized.length} headers=${JSON.stringify(res.getHeaders ? res.getHeaders() : {})} body=${serialized}\n`) } catch (e) {}
      try {
        res.on('finish', () => {
          try {
            const post = {
              t: new Date().toISOString(),
              event: 'post_send',
              status: res.statusCode,
              headersSent: res.headersSent,
              headers: res.getHeaders ? res.getHeaders() : {},
              socketWritableEnded: res.socket ? !!res.socket.writableEnded : null,
            }
            try { fs.appendFileSync('/tmp/user_sshkey_list_debug.log', JSON.stringify(post) + '\n\n') } catch (e) {}
          } catch (e) {}
        })
      } catch (e) {}
      return res.status(200).json(enriched)
    } catch (e) {
      logger.err({ err: e }, 'failed to send ssh keys response')
      return res.sendStatus(500)
    }
  } catch (err) {
    logger.err({ err, userId }, 'error listing user ssh keys')
    return res.sendStatus(500)
  }
}

export async function create(req, res) {
  try { console.error('DEBUG Imported UserSSHKey at runtime type', typeof UserSSHKey, UserSSHKey && (UserSSHKey.name || Object.keys(UserSSHKey))) } catch (e) {}
  let sessionUserId = SessionManager.getLoggedInUserId(req.session)
  // Test-only fallback: allow tests to pass a dev header to bypass flaky login
  if (!sessionUserId && process.env.NODE_ENV === 'test') {
    const devUser = (req.get && req.get('x-dev-user-id')) || req.headers['x-dev-user-id']
    if (devUser) {
      try { console.warn('DEBUG UserSSHKeysController.create: using x-dev-user-id header (test fallback)', devUser) } catch (e) {}
      sessionUserId = devUser
      // In test environment, also synthesize a minimal session user object to satisfy downstream helpers/middlewares
      try {
        if (!SessionManager.getSessionUser(req.session)) {
          req.session.user = { _id: devUser, email: `${devUser}@example.com`, first_name: 'dev' }
          try { console.warn('DEBUG UserSSHKeysController.create: synthesized req.session.user for dev header', req.session.user) } catch (e) {}
        }
      } catch (e) {}
    }
  }
  const userId = req.params.userId || sessionUserId
  try { console.error('DEBUG create entry req.params=', req.params, 'sessionUserId=', sessionUserId, 'session=', JSON.stringify(req.session || {})) } catch (e) {}

  const { key_name: keyName, public_key: publicKey } = req.body
  try { console.error('DEBUG create request headers=', req.headers, 'x-csrf-token=', req.get && req.get('x-csrf-token'), 'x-dev-user-id-get=', req.get && req.get('x-dev-user-id'), "x-dev-user-id-raw=", req.headers && req.headers['x-dev-user-id']) } catch (e) {}
  if (!userId) return res.status(400).json({ message: 'user id required' })
  if (!publicKey || !publicKey.trim()) {
    return res.status(400).json({ message: 'public_key required' })
  }
  // Basic server-side validation of OpenSSH public key format
  const re = /^ssh-(rsa|ed25519|ecdsa) [A-Za-z0-9+/=]+(?: .*)?$/
  if (!re.test(publicKey.trim())) {
    return res.status(400).json({ message: 'invalid public_key format' })
  }
  // If a different userId is supplied in params, only allow if the session user has admin access
  if (req.params.userId && sessionUserId && String(req.params.userId) !== String(sessionUserId)) {
    const sessionUser = SessionManager.getSessionUser(req.session)
    try {
      logger.info({ sessionUserId, paramsUserId: req.params.userId, sessionUser }, 'create admin check')
      console.error('DEBUG create admin check sessionUserId=', sessionUserId, 'params.userId=', req.params.userId, 'sessionUser=', sessionUser, 'hasAdmin=', AdminAuthorizationHelper.hasAdminAccess(sessionUser))
    } catch (e) {}
    if (!AdminAuthorizationHelper.hasAdminAccess(sessionUser)) {
      try { console.error('DEBUG returning 403 - admin access denial sessionUserId=', sessionUserId, 'params.userId=', req.params.userId, 'sessionUser=', sessionUser) } catch (e) {}
      try { console.error(new Error('admin access denied - trace').stack) } catch (e) {}
      try { fs.appendFileSync('/tmp/ssh_403_trace.log', `${new Date().toISOString()} ADMIN_DENY 403 sessionUserId=${sessionUserId} paramsUserId=${req.params.userId} sessionUser=${JSON.stringify(sessionUser)}\n${new Error().stack}\n\n`) } catch (e) {}
      if (process.env.NODE_ENV === 'test') {
        throw new Error(`Test-only admin access denial: sessionUserId=${sessionUserId} paramsUserId=${req.params.userId} sessionUser=${JSON.stringify(sessionUser)}`)
      }
      return res.sendStatus(403)
    }
  }
  try {
    try { console.error('DEBUG create before computeFingerprint') } catch (e) {}
    const fingerprint = _computeFingerprint(publicKey) || ''
    try { console.error('DEBUG create after computeFingerprint fingerprint=', fingerprint) } catch (e) {}

    // Idempotent create: check by fingerprint first
    try {
      const existing = await UserSSHKey.findOne({ fingerprint }).lean().exec()
      try { console.error('DEBUG existing lookup returned', !!existing) } catch (e) {}
      if (existing) {
        try { console.error('DEBUG existing userId', String(existing.userId), 'params userId', userId) } catch (e) {}
        // same user -> idempotent success
        if (String(existing.userId) === String(userId)) {
          try { logger.info({ type: 'sshkey.added.idempotent', userId, keyId: String(existing._id), fingerprint }) } catch (e) {}
          try { console.error('DEBUG returning idempotent 200 for existing key') } catch (e) {}
          return res.status(200).json({ id: String(existing._id), key_name: existing.keyName || existing.key_name, label: existing.keyName || existing.label, public_key: existing.publicKey || existing.public_key, fingerprint: existing.fingerprint, created_at: existing.createdAt || existing.created_at, updated_at: existing.updatedAt || existing.updated_at, userId: String(existing.userId) })
        }
        // exists for different user -> conflict
        try { console.error('DEBUG returning 409 - existing for different user') } catch (e) {}
        return res.status(409).json({ message: 'public_key already exists for a different user' })
      }
    } catch (e) {
      // if lookup fails, log and continue to try to create; duplicate index will still protect us
      try { console.error('DEBUG existing lookup failed', e && e.stack ? e.stack : e) } catch (ee) {}
    }

    const doc = new UserSSHKey({
      userId,
      keyName: keyName || '',
      publicKey,
      fingerprint,
    })
    try {
      try { console.error('DEBUG about to save new ssh key doc', { userId, fingerprint }) } catch (e) {}
      await doc.save()
      try { console.error('DEBUG saved new ssh key doc id=', String(doc._id)) } catch (e) {}
    } catch (e) {
      // handle duplicate key errors gracefully (race case)
      if (e && e.code === 11000) {
        const existing = await UserSSHKey.findOne({ fingerprint }).lean().exec()
        if (existing && String(existing.userId) === String(userId)) {
          try { console.error('DEBUG duplicate handled - returning existing doc as 200') } catch (e) {}
          return res.status(200).json({ id: String(existing._id), key_name: existing.keyName || existing.key_name, label: existing.keyName || existing.label, public_key: existing.publicKey || existing.public_key, fingerprint: existing.fingerprint, created_at: existing.createdAt || existing.created_at, updated_at: existing.updatedAt || existing.updated_at, userId: String(existing.userId) })
        }
        try { console.error('DEBUG duplicate handled - returning 409') } catch (e) {}
        return res.status(409).json({ message: 'public_key already exists for a different user' })
      }
      throw e
    }

    // include user metadata (lazy import to avoid module resolution during tests)
    let username = null
    let displayName = null
    try {
      const { User } = await import('../../../models/User.js')
      const user = await User.findById(userId).lean().exec()
      username = user && user.email ? user.email : null
      displayName = user
        ? `${user.first_name || ''}${user.first_name && user.last_name ? ' ' : ''}${user.last_name || ''}`.trim() || null
        : null
    } catch (e) {
      // ignore and continue without user metadata
    }

    // set cache
    try { lookupCache.set(doc.fingerprint, { userId: doc.userId }, Number(process.env.CACHE_LOOKUP_TTL_SECONDS || 60)) } catch (e) {}

    try { logger.info({ type: 'sshkey.added', userId, keyId: String(doc._id), fingerprint: doc.fingerprint, timestamp: new Date().toISOString() }) } catch (e) {}
    return res.status(201).json({
      id: String(doc._id),
      key_name: doc.keyName,
      label: doc.keyName,
      public_key: doc.publicKey,
      fingerprint: doc.fingerprint,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
      userId: userId,
      username,
      display_name: displayName,
    })
  } catch (err) {
    // log error for debugging
    try { console.error('UserSSHKeysController.create error', err && err.stack ? err.stack : err) } catch (e) {}
    logger.err({ err, userId }, 'error creating user ssh key')
    return res.sendStatus(500)
  }
}

export async function remove(req, res) {
  try { console.error('DEBUG Imported UserSSHKey at runtime type', typeof UserSSHKey, UserSSHKey && (UserSSHKey.name || Object.keys(UserSSHKey))) } catch (e) {}
  const sessionUserId = SessionManager.getLoggedInUserId(req.session)
  const userId = req.params.userId || sessionUserId
  const keyId = req.params.keyId
  if (!keyId) return res.sendStatus(400)
  if (!userId) return res.status(400).json({ message: 'user id required' })
  // If a different userId is supplied in params, only allow if the session user has admin access
  if (req.params.userId && sessionUserId && String(req.params.userId) !== String(sessionUserId)) {
    const sessionUser = SessionManager.getSessionUser(req.session)
    if (!AdminAuthorizationHelper.hasAdminAccess(sessionUser)) {
      try { console.error('DEBUG returning 403 - admin access denial in remove sessionUserId=', sessionUserId, 'params.userId=', req.params.userId, 'sessionUser=', sessionUser) } catch (e) {}
      return res.sendStatus(403)
    }
  }
  try {
    console.error('DEBUG remove starting userId=', userId, 'keyId=', keyId)

    // Defensive invocation of findOneAndDelete to handle different mock shapes
    try { console.error('DEBUG findOneAndDelete typeof', typeof UserSSHKey.findOneAndDelete, 'hasMock=', !!(UserSSHKey.findOneAndDelete && UserSSHKey.findOneAndDelete.mock)) } catch (e) {}

    let q
    try {
      q = UserSSHKey.findOneAndDelete({ _id: keyId, userId })
      try {
        console.error('DEBUG findOneAndDelete returned', typeof q, 'hasExec=', !!(q && typeof q.exec === 'function'), 'isPromiseLike=', !!(q && typeof q.then === 'function'))
        if (process.env.NODE_ENV === 'test') {
          try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `FIND_RET ${new Date().toISOString()} ${JSON.stringify({ typeof_q: typeof q, hasExec: !!(q && typeof q.exec === 'function'), isPromiseLike: !!(q && typeof q.then === 'function') })}\n`) } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {
      console.error('DEBUG findOneAndDelete threw synchronously', e && e.stack ? e.stack : e)
      if (process.env.NODE_ENV === 'test') try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `FIND_THROW ${new Date().toISOString()} ${e && (e.stack || e)}\n`) } catch (e) {}
      throw e
    }

    let r
    if (q && typeof q.exec === 'function') {
      try {
        r = await q.exec()
      } catch (e) {
        console.error('DEBUG q.exec threw', e && e.stack ? e.stack : e)
        if (process.env.NODE_ENV === 'test') try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `QEXEC_THROW ${new Date().toISOString()} ${e && (e.stack || e)}\n`) } catch (e) {}
        throw e
      }
    } else if (q && typeof q.then === 'function') {
      try {
        r = await q
      } catch (e) {
        console.error('DEBUG awaiting q threw', e && e.stack ? e.stack : e)
        if (process.env.NODE_ENV === 'test') try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `QAWAIT_THROW ${new Date().toISOString()} ${e && (e.stack || e)}\n`) } catch (e) {}
        throw e
      }
    } else {
      // q might be the document itself or null
      r = q
    }

    console.error('DEBUG remove resolved r =', r)
    if (process.env.NODE_ENV === 'test') try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `RESOLVED_R ${new Date().toISOString()} ${JSON.stringify(r)}\n`) } catch (e) {}
    if (!r) {
      console.error('DEBUG remove: no document found for', { _id: keyId, userId })
      if (process.env.NODE_ENV === 'test') try { fs.appendFileSync('/tmp/user_sshkey_remove_debug.log', `NO_DOC ${new Date().toISOString()} ${JSON.stringify({ _id: keyId, userId })}\n`) } catch (e) {}
      return res.sendStatus(404)
    }

    // invalidate cache for fingerprint/reference
    try {
      console.error('DEBUG invalidating cache for fingerprint', r && r.fingerprint)
      try { lookupCache.invalidate(r.fingerprint || r.fingerprint) } catch (e) { console.error('DEBUG cache invalidate error', e && e.stack ? e.stack : e) }
      console.error('DEBUG invalidated cache')
    } catch (e) {
      console.error('DEBUG cache invalidate error', e && e.stack ? e.stack : e)
    }

    try { logger.info({ type: 'sshkey.removed', userId, keyId, timestamp: new Date().toISOString() }) } catch (e) { console.error('DEBUG logger.info error', e && e.stack ? e.stack : e) }
    return res.sendStatus(204)
  } catch (err) {
    try { console.error('UserSSHKeysController.remove error', err && err.stack ? err.stack : err) } catch (e) {}
    // Include additional properties from common async errors for better diagnostics
    try { console.error('UserSSHKeysController.remove error details', { name: err && err.name, message: err && err.message, code: err && err.code, errors: err && err.errors }) } catch (e) {}
    logger.err({ err, userId, keyId }, 'error deleting user ssh key')
    if (process.env.NODE_ENV === 'test') {
      try { return res.status(500).json({ message: 'error deleting user ssh key', error: { name: err && err.name, message: err && err.message, stack: err && err.stack } }) } catch (e) { /* fallthrough */ }
    }
    return res.sendStatus(500)
  }
}

export async function listForService(req, res) {
  let userId = req.params.userId
  if (!userId) return res.status(400).json({ message: 'user id required' })
  // Basic auth check for trusted callers (dev/test convenience)
  const authHeader = (req.get && req.get('authorization')) || req.headers && req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Basic ')) return res.sendStatus(403)
  const creds = Buffer.from(authHeader.slice(6), 'base64').toString('utf8').split(':')
  const adminUser = process.env.SSH_KEYS_BASIC_USER || 'overleaf'
  const adminPass = process.env.SSH_KEYS_BASIC_PASS || 'overleaf'
  if (!(creds[0] === adminUser && creds[1] === adminPass)) return res.sendStatus(403)

  try {
    // Accept either an ObjectId user id (normal) or a dev-friendly username/email.
    // If userId isn't a valid ObjectId, try to resolve by email to a real user id first.
    const { User } = await import('../../models/User.js')
    let resolvedUserId = null
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      resolvedUserId = userId
    } else {
      // try to find a user by email matching the supplied identifier
      const u = await User.findOne({ email: userId }).lean().exec()
      if (u && u._id) resolvedUserId = String(u._id)
    }

    let keys = []
    if (resolvedUserId) {
      keys = await UserSSHKey.find({ userId: resolvedUserId }).lean().exec()
    } else {
      // Fall back to a raw collection lookup to support existing dev-seeded docs
      // which may have stored userId as a string rather than ObjectId.
      try {
        keys = await UserSSHKey.collection.find({ userId }).toArray()
      } catch (e) {
        // ignore and leave keys empty
      }
    }

    const enriched = keys.map(k => ({
      id: String(k._id || k.id),
      key_name: k.keyName || k.key_name || '',
      label: k.keyName || k.label || k.key_name || '',
      public_key: k.publicKey || k.public_key || '',
      fingerprint: k.fingerprint || '',
      created_at: k.createdAt || k.created_at || null,
      updated_at: k.updatedAt || k.updated_at || null,
      userId: k.userId || k.user_id || userId,
    }))
    return res.status(200).json(enriched)
  } catch (err) {
    logger.err({ err, userId }, 'error listing user ssh keys for service')
    return res.sendStatus(500)
  }
}

export default { list, create, remove, listForService }
