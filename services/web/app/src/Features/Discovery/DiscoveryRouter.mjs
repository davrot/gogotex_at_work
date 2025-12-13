import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import SSHKeyLookupController from './SSHKeyLookupController.mjs'

const rateLimiters = {
  fingerprintLookup: new RateLimiter('fingerprint-lookup', { points: 60, duration: 60 }),
}

export default {
  apply(webRouter, privateApiRouter) {
    privateApiRouter.get(
      '/internal/api/ssh-keys/:fingerprint',
      AuthenticationController.requirePrivateApiAuth(),
      RateLimiterMiddleware.rateLimit(rateLimiters.fingerprintLookup),
      SSHKeyLookupController.lookup
    )
  },
}
