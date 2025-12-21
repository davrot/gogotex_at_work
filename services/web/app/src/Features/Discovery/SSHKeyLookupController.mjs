import { UserSSHKey } from '../../models/UserSSHKey.js'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import { sshFingerprintLookupRateLimiter } from '../../infrastructure/RateLimiter.js'
import ServiceOrigin from '../../infrastructure/ServiceOrigin.mjs'

export async function lookup(req, res) {
  const timer = new metrics.Timer('ssh.key_lookup')
  const fingerprint = req.params.fingerprint
  if (!fingerprint || !fingerprint.trim()) {
    timer.done()
    return res.status(400).json({ message: 'fingerprint required' })
  }
  // Validate canonical fingerprint format: 'SHA256:<base64>' with 44 character base64 payload
  if (!fingerprint.startsWith('SHA256:')) {
    timer.done()
    return res.status(400).json({ message: 'invalid fingerprint format' })
  }
  const base = fingerprint.slice(7)
  // RFC: SHA256 digest is 32 bytes encoded into base64 = 44 characters
  if (!/^[A-Za-z0-9+/]+=*$/.test(base) || base.length !== 44) {
    timer.done()
    return res.status(400).json({ message: 'invalid fingerprint format' })
  }

  // per service-origin rate limit
  try {
    const originKey = ServiceOrigin.originRateKey(req)
    await sshFingerprintLookupRateLimiter.consume(originKey, 1, { method: 'service-origin' })
  } catch (err) {
    try { metrics.inc('ssh.key_lookup.rate_limited', 1) } catch (e) {}
    timer.done()
    return res.sendStatus(429)
  }

  try {
    // If configured, delegate fingerprint lookup to Go webprofile API (opt-in)
    if (process.env.AUTH_SSH_USE_WEBPROFILE_API === 'true') {
      try {
        const client = await import(new URL('../Token/WebProfileClient.mjs', import.meta.url).href)
        const resObj = await client.getSSHKeyByFingerprint(fingerprint)
        if (resObj && resObj.userId) {
          // Cache the positive/negative result as before
          try { const lookupCacheModule = await import('../../lib/lookupCache.mjs'); const lookupCache = (lookupCacheModule && lookupCacheModule.default) || lookupCacheModule; lookupCache && lookupCache.set && lookupCache.set(fingerprint, { userId: resObj.userId }, Number(process.env.CACHE_LOOKUP_TTL_SECONDS || 60)) } catch (e) {}
          timer.done()
          metrics.inc('ssh.key_lookup.hit', 1)
          return res.status(200).json({ userId: String(resObj.userId) })
        }
        if (resObj === null) {
          // explicit 404 from upstream
          try { const lookupCacheModule = await import('../../lib/lookupCache.mjs'); const lookupCache = (lookupCacheModule && lookupCacheModule.default) || lookupCacheModule; lookupCache && lookupCache.set && lookupCache.set(fingerprint, null, Number(process.env.CACHE_NEGATIVE_TTL_SECONDS || 5)) } catch (e) {}
          timer.done()
          metrics.inc('ssh.key_lookup.miss', 1)
          return res.status(404).json({})
        }
        // otherwise fall through to DB-backed lookup
      } catch (e) {
        try { logger.err({ err: e, fingerprint }, 'webprofile ssh fingerprint delegation failed, falling back to DB') } catch (ee) {}
      }
    }

    // caching: consult lookup cache first
    try { const lookupCacheModule = await import('../../lib/lookupCache.mjs'); const lookupCache = (lookupCacheModule && lookupCacheModule.default) || lookupCacheModule; const cached = lookupCache && lookupCache.get && lookupCache.get(fingerprint); if (typeof cached !== 'undefined') { timer.done(); metrics.inc(cached ? 'ssh.key_lookup.hit' : 'ssh.key_lookup.miss', 1); if (!cached) return res.status(404).json({}); return res.status(200).json({ userId: String(cached.userId) }) } } catch (e) {}

    const key = await UserSSHKey.findOne({ fingerprint }).lean().exec()
    if (!key) {
      timer.done()
      metrics.inc('ssh.key_lookup.miss', 1)
      try { const lookupCacheModule = await import('../../lib/lookupCache.mjs'); const lookupCache = (lookupCacheModule && lookupCacheModule.default) || lookupCacheModule; lookupCache && lookupCache.set && lookupCache.set(fingerprint, null, Number(process.env.CACHE_NEGATIVE_TTL_SECONDS || 5)) } catch (e) {}
      return res.status(404).json({})
    }
    metrics.inc('ssh.key_lookup.hit', 1)

    try { const lookupCacheModule = await import('../../lib/lookupCache.mjs'); const lookupCache = (lookupCacheModule && lookupCacheModule.default) || lookupCacheModule; lookupCache && lookupCache.set && lookupCache.set(fingerprint, { userId: key.userId }, Number(process.env.CACHE_LOOKUP_TTL_SECONDS || 60)) } catch (e) {}

    timer.done()
    return res.status(200).json({ userId: String(key.userId) })
  } catch (err) {
    logger.err({ err, fingerprint }, 'error looking up ssh key fingerprint')
    metrics.inc('ssh.key_lookup.error', 1)
    timer.done()
    return res.sendStatus(500)
  }
}

export default { lookup }
