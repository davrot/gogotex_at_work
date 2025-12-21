import logger from '@overleaf/logger'

const DEFAULT_BASE = process.env.AUTH_LOCAL_INTROSPECT_URL || 'http://localhost:3900'
const BASIC_AUTH_USER = process.env.WEBPROFILE_ADMIN_USER || 'overleaf'
const BASIC_AUTH_PASS = process.env.WEBPROFILE_ADMIN_PASS || 'overleaf'

// Helper: perform fetch with a bounded timeout so tests and CI cannot hang
// if a remote service or a test stub returns a promise that never resolves.
// Uses Promise.race to ensure we always reject after timeoutMs milliseconds.
async function fetchWithTimeout (url, opts = {}, timeoutMs = Number(process.env.WEBPROFILE_FETCH_TIMEOUT_MS || 3000)) {
  const fetchPromise = fetch(url, opts)
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      const err = new Error(`fetch timeout after ${timeoutMs}ms`)
      err.name = 'FetchTimeoutError'
      reject(err)
    }, timeoutMs)
  })
  return Promise.race([fetchPromise, timeoutPromise])
}

function authHeader() {
  const cred = Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
  return `Basic ${cred}`
}

export async function introspect(token) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/tokens/introspect`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ token }),
      })
    } catch (err) {
      logger.err({ err }, 'webprofile introspect call failed (timeout or network)')
      return null
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}))
      return { error: 'bad_request', body }
    }
    if (res.status !== 200) return null
    return await res.json()
  } catch (err) {
    logger.err({ err }, 'webprofile introspect call failed')
    return null
  }
}

export async function createToken(userId, payload) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/git-tokens`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      logger.err({ err }, 'webprofile create token call failed (timeout or network)')
      return null
    }
    if (res.status !== 200 && res.status !== 201) return null
    return await res.json()
  } catch (err) {
    logger.err({ err }, 'webprofile create token call failed')
    return null
  }
}

export async function listTokens(userId) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/git-tokens`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Authorization: authHeader() },
      })
    } catch (err) {
      logger.err({ err }, 'webprofile list tokens call failed (timeout or network)')
      return null
    }
    if (res.status !== 200) return null
    return await res.json()
  } catch (err) {
    logger.err({ err }, 'webprofile list tokens call failed')
    return null
  }
}

export async function revokeToken(userId, tokenId) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/git-tokens/${encodeURIComponent(tokenId)}`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, { method: 'DELETE', headers: { Authorization: authHeader() } })
    } catch (err) {
      logger.err({ err }, 'webprofile revoke call failed (timeout or network)')
      return false
    }
    return res.status === 204
  } catch (err) {
    logger.err({ err }, 'webprofile revoke call failed')
    return false
  }
}

// ---- SSH key support ----

export async function createSSHKey(userId, { public_key, key_name }) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/ssh-keys`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ public_key, key_name }),
      })
    } catch (err) {
      logger.err({ err }, 'webprofile create ssh key call failed (timeout or network)')
      return null
    }
    if (res.status !== 200 && res.status !== 201) return null
    return await res.json()
  } catch (err) {
    logger.err({ err }, 'webprofile create ssh key call failed')
    return null
  }
}

export async function listSSHKeys(userId) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/ssh-keys`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Authorization: authHeader() },
      })
    } catch (err) {
      logger.err({ err }, 'webprofile list ssh keys call failed (timeout or network)')
      return null
    }
    if (res.status !== 200) return null
    return await res.json()
  } catch (err) {
    logger.err({ err }, 'webprofile list ssh keys call failed')
    return null
  }
}

export async function removeSSHKey(userId, keyId) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/ssh-keys/${encodeURIComponent(keyId)}`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, { method: 'DELETE', headers: { Authorization: authHeader() } })
    } catch (err) {
      logger.err({ err }, 'webprofile remove ssh key call failed (timeout or network)')
      return false
    }
    return res.status === 204
  } catch (err) {
    logger.err({ err }, 'webprofile remove ssh key call failed')
    return false
  }
}

// ---- Fingerprint lookup support ----
export async function getSSHKeyByFingerprint(fingerprint) {
  const url = `${DEFAULT_BASE.replace(/\/$/, '')}/internal/api/ssh-keys/${encodeURIComponent(fingerprint)}`
  try {
    let res
    try {
      res = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: authHeader(), Accept: 'application/json' } })
    } catch (err) {
      logger.err({ err }, 'webprofile fingerprint lookup call failed (timeout or network)')
      return undefined
    }
    if (res.status === 200) return await res.json()
    if (res.status === 404) return { notFound: true }
    return { error: true }
  } catch (err) {
    logger.err({ err }, 'webprofile fingerprint lookup call failed')
    // Return undefined to indicate an unexpected error so callers may fall back
    return undefined
  }
}
