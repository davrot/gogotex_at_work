import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import TokenController from './TokenController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'
import ServiceOrigin from '../../infrastructure/ServiceOrigin.mjs'

const rateLimiters = {
  tokenCreate: new RateLimiter('token-create', { points: 10, duration: 60 }),
}

export default {
  apply(webRouter) {
    // user-level endpoints for token management
    webRouter.post('/internal/api/users/:userId/git-tokens', AuthenticationController.requireLogin(), RateLimiterMiddleware.rateLimit(rateLimiters.tokenCreate), TokenController.create)
    webRouter.get('/internal/api/users/:userId/git-tokens', (req, res, next) => { try { console.error('[ROUTE DEBUG] /internal/api/users/:userId/git-tokens incoming', { method: req.method, url: req.originalUrl || req.url, headers: { cookie: req.headers && req.headers.cookie, 'x-service-origin': req.headers && req.headers['x-service-origin'] }, sessionExists: !!req.session, sessionUserId: req.session && req.session.user && req.session.user._id ? req.session.user._id : null }) } catch (e) {} next() }, AuthenticationController.requireLogin(), TokenController.list)
    webRouter.delete('/internal/api/users/:userId/git-tokens/:tokenId', AuthenticationController.requireLogin(), TokenController.remove)

    // public/internal token introspection is available to other services; mount under privateApiRouter in router.mjs
  },
}
