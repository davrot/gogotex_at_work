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
    return res.sendStatus(500)
  }
}

export async function list(req, res) {
  const userId = req.params.userId
  // rate-limit per service-origin
  try {
    const originKey = ServiceOrigin.originRateKey(req)
    await tokenIntrospectRateLimiter.consume(originKey, 1, { method: 'service-origin' })
  } catch (err) {
    try { metrics.inc('token.list.rate_limited', 1) } catch (e) {}
    return res.sendStatus(429)
  }
  try {
    const tokens = await PersonalAccessTokenManager.listTokens(userId)
    return res.status(200).json(tokens)
  } catch (err) {
    logger.err({ err, userId }, 'error listing personal access tokens')
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

  try {
    const info = await PersonalAccessTokenManager.introspect(token)
    if (info && info.active) {
      try { logger.info({ type: 'token.used', userId: info.userId, scopes: info.scopes, timestamp: new Date().toISOString() }) } catch (e) {}
      metrics.inc('token.introspect.hit', 1)
    } else {
      metrics.inc('token.introspect.miss', 1)
    }
    timer.done()
    return res.status(200).json(info)
  } catch (err) {
    logger.err({ err }, 'error introspecting token')
    metrics.inc('token.introspect.error', 1)
    timer.done()
    return res.sendStatus(500)
  }
}

export default { create, list, remove, introspect }
