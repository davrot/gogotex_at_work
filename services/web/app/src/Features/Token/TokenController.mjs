import PersonalAccessTokenManager from './PersonalAccessTokenManager.mjs'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'

export async function create(req, res) {
  const userId = req.params.userId
  const { label, scopes, expiresAt } = req.body || {}
  try {
    const result = await PersonalAccessTokenManager.createToken(userId, { label, scopes, expiresAt })
    // Return plaintext token once and masked hashPrefix
    try {
      logger.info({ type: 'token.created', userId, tokenId: result.id, hashPrefix: result.hashPrefix, timestamp: new Date().toISOString() })
    } catch (e) {}
    return res.status(201).json({ id: result.id, token: result.token, accessTokenPartial: result.hashPrefix })
  } catch (err) {
    logger.err({ err, userId }, 'error creating personal access token')
    try { console.error('[TokenController.create] error', err && (err.stack || err)) } catch (e) {}
    return res.sendStatus(500)
  }
}

export async function list(req, res) {
  const userId = req.params.userId
  try { console.error('[TokenController.list] incoming', { userId, reqIp: req.ip, headers: { 'x-service-origin': req.headers && req.headers['x-service-origin'], cookie: req.headers && req.headers.cookie }, sessionExists: !!req.session, sessionUser: req.session && req.session.user ? { _id: req.session.user._id, email: req.session.user.email } : null }) } catch (e) {}
  // rate-limit per service-origin
  try {
    const originKey = ServiceOrigin.originRateKey(req)
    await tokenIntrospectRateLimiter.consume(originKey, 1, { method: 'service-origin' })
  } catch (err) {
    // Debug: log origin key and error to help diagnose unexpected 429s in tests
    try { logger.warn({ origin: ServiceOrigin.originRateKey(req), err: err && (err.message || err) }, 'token.list rate limited') } catch (e) {}
    try { console.error('[TokenController.list] rate-limited originKey=', ServiceOrigin.originRateKey(req), 'err=', err && err instanceof Error ? err.message : err) } catch (e) {}
    try { metrics.inc('token.list.rate_limited', 1) } catch (e) {}
    return res.sendStatus(429)
  }
  try {
    const tokens = await PersonalAccessTokenManager.listTokens(userId)
    return res.status(200).json(tokens)
  } catch (err) {
    logger.err({ err, userId }, 'error listing personal access tokens')
    // Ensure error visible in test logs
    try { console.error('[TokenController.list] error listing tokens', err && (err.stack || err)) } catch (e) {}
    return res.sendStatus(500)
  }
}

export async function remove(req, res) {
  const userId = req.params.userId
  const tokenId = req.params.tokenId
  try {
    const ok = await PersonalAccessTokenManager.revokeToken(userId, tokenId)
    if (!ok) return res.sendStatus(404)
    try { logger.info({ type: 'token.revoked', userId, tokenId, timestamp: new Date().toISOString() }) } catch (e) {}
    return res.sendStatus(204)
  } catch (err) {
    logger.err({ err, userId, tokenId }, 'error revoking personal access token')
    return res.sendStatus(500)
  }
}

import { tokenIntrospectRateLimiter } from '../../infrastructure/RateLimiter.js'
import ServiceOrigin from '../../infrastructure/ServiceOrigin.mjs'

export async function introspect(req, res) {
  const timer = new metrics.Timer('token.introspect')
  const { token } = req.body || {}
  if (!token) {
    timer.done()
    return res.status(400).json({ message: 'token required' })
  }

  // Debug: mask token received for introspection (never log plaintext)
  try { console.debug('[TokenController.introspect] tokenMask=', token && (token.slice(0,8) + '...')) } catch (e) {}

  // rate-limit per service-origin
  try {
    const originKey = ServiceOrigin.originRateKey(req)
    await tokenIntrospectRateLimiter.consume(originKey, 1, { method: 'service-origin' })
  } catch (err) {
    // rate-limited
    try { metrics.inc('token.introspect.rate_limited', 1) } catch (e) {}
    timer.done()
    return res.sendStatus(429)
  }

  // Reject obviously malformed tokens (tokens are hex strings)
  if (!/^[0-9a-f]+$/i.test(token)) {
    timer.done()
    return res.status(400).json({ message: 'invalid token format' })
  }

  try {
    const info = await PersonalAccessTokenManager.introspect(token)

    // Debug: log introspect results and origin
    try { logger.debug({ origin: ServiceOrigin.getServiceOrigin(req), tokenMask: token && token.slice(0,8) + '...', result: info }, 'token.introspect debug') } catch (e) {}

    if (info && info.active) {
      try { logger.info({ type: 'token.used', userId: info.userId, scopes: info.scopes, timestamp: new Date().toISOString() }) } catch (e) {}
      metrics.inc('token.introspect.hit', 1)
    } else {
      metrics.inc('token.introspect.miss', 1)
    }

    // Record audit entry for token introspect so retention/PII test can find it
    try {
      const UserAuditLogHandler = (await import('../User/UserAuditLogHandler.mjs')).default
      const entryInfo = { scopes: info?.scopes || [], outcome: info?.active ? 'success' : 'failure', resourceId: info?.hashPrefix }
      // allow null initiatorId (service-origin) — handler updated to accept token.introspect without initiator
      await UserAuditLogHandler.promises.addEntry(info && info.userId ? info.userId : null, 'token.introspect', null, req.ip, entryInfo)
    } catch (e) {
      try { logger.err({ err: e }, 'failed to write token.introspect audit entry') } catch (e2) {}
    }

    timer.done()
    return res.status(200).json(info)
  } catch (err) {
    logger.err({ err, stack: err && err.stack }, 'error introspecting token')
    // Ensure error visible in test logs
    try { console.error(err && (err.stack || err)) } catch (e) {}
    metrics.inc('token.introspect.error', 1)
    timer.done()
    return res.sendStatus(500)
  }
}

export default { create, list, remove, introspect }
