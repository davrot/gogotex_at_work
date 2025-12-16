const { RateLimiter } = require('../../infrastructure/RateLimiter')
const { callbackify } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')

const rateLimiterLoginEmail = new RateLimiter(
  'login',
  Settings.rateLimit?.login?.email || {
    points: 10,
    duration: 120,
  }
)

function normalizeEmail (email) {
  if (typeof email !== 'string') return email
  return String(email).trim().toLowerCase()
}

async function processLoginRequest(email) {
  const key = normalizeEmail(email)
  try {
    await rateLimiterLoginEmail.consume(key, 1, {
      method: 'email',
    })
    return true
  } catch (err) {
    if (err instanceof Error) {
      throw err
    } else {
      return false
    }
  }
}

async function recordSuccessfulLogin(email) {
  const key = normalizeEmail(email)
  await rateLimiterLoginEmail.delete(key)
}

const LoginRateLimiter = {
  processLoginRequest: callbackify(processLoginRequest),
  recordSuccessfulLogin: callbackify(recordSuccessfulLogin),
}
LoginRateLimiter.promises = {
  processLoginRequest,
  recordSuccessfulLogin,
}

module.exports = LoginRateLimiter
