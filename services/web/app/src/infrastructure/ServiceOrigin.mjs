// ServiceOrigin detection precedence:
// 1. `X-Service-Origin` header (canonical, authoritative)
// 2. mTLS client certificate CN (when present)
// 3. request IP (via `x-forwarded-for` or connection.remoteAddress)
function _parseTrustedProxies() {
  const env = process.env.TRUSTED_PROXIES || ''
  if (!env) return []
  return env.split(',').map(s => s.trim()).filter(Boolean)
}

function _isIpTrusted(remoteIp) {
  const list = _parseTrustedProxies()
  if (list.length === 0) return true // permissive if no list configured
  return list.includes(String(remoteIp))
}

export function getServiceOrigin(req) {
  if (!req || typeof req !== 'object') return null
  const headers = req.headers || {}
  const headerVal = headers['x-service-origin'] || headers['X-Service-Origin'] || headers['x-service-origin'.toLowerCase()]

  // Header is only authoritative when explicitly allowed by env
  const allowHeader = process.env.TRUST_X_SERVICE_ORIGIN === 'true'
  if (allowHeader && headerVal && typeof headerVal === 'string' && headerVal.trim().length > 0) {
    // also check that the request came from a trusted proxy/IP if configured
    const remoteIp = req.ip || (req.headers && req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0]) || (req.connection && req.connection.remoteAddress)
    if (_isIpTrusted(remoteIp)) return headerVal.trim()
  }

  // Try mTLS client certificate CN
  try {
    const socket = req.socket || req.connection || {}
    if (socket && typeof socket.getPeerCertificate === 'function') {
      const cert = socket.getPeerCertificate()
      if (cert && cert.subject && cert.subject.CN) return cert.subject.CN
    }
  } catch (e) {
    // ignore any TLS inspection errors
  }
  // Fallback to IP if present
  const ip = req.ip || (req.headers && req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0]) || (req.connection && req.connection.remoteAddress)
  if (ip) return `ip:${String(ip)}`
  return null
}

export function originRateKey(req) {
  const origin = getServiceOrigin(req)
  if (!origin) return 'service-origin:unknown'
  return `service-origin:${origin}`
}

export default { getServiceOrigin, originRateKey }
