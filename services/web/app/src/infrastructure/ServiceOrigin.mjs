// ServiceOrigin detection precedence:
// 1. `X-Service-Origin` header (canonical, authoritative)
// 2. mTLS client certificate CN (when present)
// 3. request IP (via `x-forwarded-for` or connection.remoteAddress)
export function getServiceOrigin(req) {
  if (!req || typeof req !== 'object') return null
  const headers = req.headers || {}
  const headerVal = headers['x-service-origin'] || headers['X-Service-Origin'] || headers['x-service-origin'.toLowerCase()]
  if (headerVal && typeof headerVal === 'string' && headerVal.trim().length > 0) return headerVal.trim()
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
