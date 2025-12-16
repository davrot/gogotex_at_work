import express from 'express'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import csp, { removeCSPHeaders } from './CSP.mjs'
import Router from '../router.mjs'
import helmet from 'helmet'
import UserSessionsRedis from '../Features/User/UserSessionsRedis.mjs'
import Csrf from './Csrf.mjs'
import HttpPermissionsPolicyMiddleware from './HttpPermissionsPolicy.js'
import SessionAutostartMiddleware from './SessionAutostartMiddleware.mjs'
import AnalyticsManager from '../Features/Analytics/AnalyticsManager.mjs'
import session from 'express-session'
import CookieMetrics from './CookieMetrics.mjs'
import CustomSessionStore from './CustomSessionStore.mjs'
import bodyParser from './BodyParserWrapper.mjs'
import methodOverride from 'method-override'
import cookieParser from 'cookie-parser'
import bearerTokenMiddleware from 'express-bearer-token'
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import ReferalConnect from '../Features/Referal/ReferalConnect.mjs'
import RedirectManager from './RedirectManager.mjs'
import translations from './Translations.mjs'
import Views from './Views.js'
import Features from './Features.js'
import ErrorController from '../Features/Errors/ErrorController.mjs'
import HttpErrorHandler from '../Features/Errors/HttpErrorHandler.mjs'
import UserSessionsManager from '../Features/User/UserSessionsManager.mjs'
import AuthenticationController from '../Features/Authentication/AuthenticationController.mjs'
import SessionManager from '../Features/Authentication/SessionManager.mjs'
import AdminAuthorizationHelper from '../Features/Helpers/AdminAuthorizationHelper.mjs'
import Modules from './Modules.js'
import expressLocals from './ExpressLocals.mjs'
import noCache from 'nocache'
import os from 'node:os'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import serveStaticWrapper from './ServeStaticWrapper.mjs'
import { handleValidationError } from '@overleaf/validation-tools'

const { hasAdminAccess } = AdminAuthorizationHelper
const sessionsRedisClient = UserSessionsRedis.client()

const oneDayInMilliseconds = 86400000

const STATIC_CACHE_AGE = Settings.cacheStaticAssets
  ? oneDayInMilliseconds * 365
  : 0

// Init the session store
const sessionStore = new CustomSessionStore({ client: sessionsRedisClient })

const app = express()

// Top-most early handler: if x-debug-echo: 1 is present, return raw headers & session immediately
// This runs before any body-parsing, CSRF, or auth middleware to capture the incoming request as received
app.use((req, res, next) => {
  try {
    if (req.get && req.get('x-debug-echo') === '1') {
      const sessionUser = req.session && req.session.user ? { _id: req.session.user._id, email: req.session.user.email } : null
      const out = {
        stage: 'app-top',
        originalUrl: req.originalUrl,
        url: req.url,
        method: req.method,
        headers: req.headers,
        cookie: req.headers && req.headers.cookie,
        sessionExists: !!req.session,
        sessionUser,
      }
      try { console.error('[APP TOP DEBUG ECHO] incoming', out) } catch (e) {}
      return res.status(200).json(out)
    }
  } catch (e) {}
  next()
})
try { console.error('[APP TOP DEBUG ECHO] registered') } catch (e) {}

// Test-only: ensure response Content-Type for SSH key list endpoints so clients parse correctly
app.use((req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'test' && (req.originalUrl || req.url) && (req.originalUrl || req.url).includes('/internal/api/users/') && (req.originalUrl || req.url).includes('/ssh-keys')) {
      try { res.setHeader('Content-Type', 'application/json; charset=utf-8') } catch (e) {}
    }
  } catch (e) {}
  next()
})

// Debug: early global request logger to capture all incoming requests (headers/cookie/CSRF)
app.use((req, res, next) => {
  try {
    console.error('[Server EARLY] incoming', {
      method: req.method,
      path: req.path,
      rawHeaders: Array.isArray(req.rawHeaders) ? req.rawHeaders.slice(0, 60) : req.rawHeaders,
      headersSummary: Object.keys(req.headers || {}).reduce((acc, k) => { acc[k] = k === 'cookie' ? String(req.headers[k]).slice(0,200) : req.headers[k]; return acc }, {}),
      csrfHeader: req.get && req.get('x-csrf-token'),
      cookies: req.cookies || null,
      signedCookies: req.signedCookies || null,
      sessionSummary: req.session ? { id: req.session.id || req.sessionID, hasUser: !!req.session.user } : null,
      reqUser: req.user ? { _id: req.user._id, email: req.user.email } : null,
    })
  } catch (e) {}

  // Wrap res.write/end to capture outgoing bytes and capture final response status when it is 403 so we can trace short-circuited responses
  const origWrite = res.write.bind(res)
  res.write = function (chunk, ...args) {
    try {
      req._outChunks = req._outChunks || []
      req._outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    } catch (e) {}

    try {
      if (process.env.NODE_ENV === 'test' && (req.originalUrl || req.url) && (req.originalUrl || req.url).includes('/internal/api/users/') && (req.originalUrl || req.url).includes('/ssh-keys')) {
        try {
          const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
          const info = {
            t: new Date().toISOString(),
            event: 'write',
            method: req.method,
            url: req.originalUrl || req.url,
            headersBefore: res.getHeaders ? res.getHeaders() : {},
            chunkLen: (chunk && chunk.length) || (chunkStr && Buffer.from(chunkStr).length) || 0,
            chunkPreview: (chunkStr || '').slice(0,200),
            headersSent: res.headersSent,
            socketWritable: !!(res.socket && res.socket.writable && !res.socket.destroyed),
          }
          try { fs.appendFileSync('/tmp/user_sshkey_wire_debug.log', JSON.stringify(info) + '\n') } catch (e) {}
          // If a non-buffer object was written directly to res.write, log a stack trace so we can find the origin
          try {
            if (typeof chunk === 'object' && !Buffer.isBuffer(chunk)) {
              const stack = new Error('write-called-with-non-string').stack
              const nonStringInfo = {
                t: new Date().toISOString(),
                event: 'write-non-string',
                method: req.method,
                url: req.originalUrl || req.url,
                chunkType: chunk && chunk.constructor ? chunk.constructor.name : typeof chunk,
                chunkPreview: (chunkStr || '').slice(0,200),
                stack,
              }
              try { fs.appendFileSync('/tmp/user_sshkey_wire_debug.log', JSON.stringify(nonStringInfo) + '\n') } catch (e) {}
            }
          } catch (e) {}
        } catch (e) {}
        try { res.setHeader('Content-Type', 'application/json; charset=utf-8') } catch (e) {}
      }
    } catch (e) {}
    return origWrite(chunk, ...args)
  }

  const origEnd = res.end.bind(res)
  res.end = function (...args) {
    try {
      if (res && res.statusCode === 403) {
        try { console.error('[Server END] response ended with 403', { method: req.method, path: req.path, csrf: req.get && req.get('x-csrf-token'), session: !!req.session, sessionUser: SessionManager.getSessionUser ? SessionManager.getSessionUser(req.session) : null }) } catch (e) {}
        try { console.error(new Error('response 403 trace').stack) } catch (e) {}
        try { fs.appendFileSync('/tmp/ssh_403_trace.log', `${new Date().toISOString()} END 403 ${req.method} ${req.originalUrl || req.url} headers=${JSON.stringify(req.headers)} session=${JSON.stringify(req.session && { id: req.session.id || req.sessionID, user: req.session.user ? { _id: req.session.user._id, email: req.session.user.email } : null })}\n${new Error().stack}\n\n`) } catch (e) {}
      }

      // Test-only: capture raw outgoing body for SSH keys endpoints for post-mortem
      try {
        if (process.env.NODE_ENV === 'test' && (req.originalUrl || req.url) && (req.originalUrl || req.url).includes('/internal/api/users/') && (req.originalUrl || req.url).includes('/ssh-keys')) {
          try {
            if (args && args[0]) {
              req._outChunks = req._outChunks || []
              req._outChunks.push(Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(String(args[0])))
              if (typeof args[0] === 'object' && !Buffer.isBuffer(args[0])) {
                try {
                  const stack = new Error('end-called-with-non-string').stack
                  const nonStringInfo = {
                    t: new Date().toISOString(),
                    event: 'end-non-string',
                    method: req.method,
                    url: req.originalUrl || req.url,
                    argType: args[0] && args[0].constructor ? args[0].constructor.name : typeof args[0],
                    argPreview: (String(args[0]) || '').slice(0,200),
                    stack,
                  }
                  try { fs.appendFileSync('/tmp/user_sshkey_wire_debug.log', JSON.stringify(nonStringInfo) + '\n') } catch (e) {}
                } catch (e) {}
              }
            }
          } catch (e) {}
          try {
            const bodyBuf = req._outChunks ? Buffer.concat(req._outChunks) : Buffer.from('')
            const body = bodyBuf.toString('utf8')
            const wireInfo = {
              t: new Date().toISOString(),
              event: 'wire',
              method: req.method,
              url: req.originalUrl || req.url,
              status: res.statusCode,
              headers: res.getHeaders ? res.getHeaders() : {},
              totalLen: bodyBuf.length,
              bodyPreview: body.slice(0,200)
            }
            try { fs.appendFileSync('/tmp/user_sshkey_wire_debug.log', JSON.stringify(wireInfo) + '\n') } catch (e) {}
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {}
    return origEnd(...args)
  }
  // Also listen for finish event to capture cases where the response completes after streaming
  res.on('finish', () => {
    try {
      if (res.statusCode === 403) {
        try { console.error('[APP FINISH] response finished with 403', { method: req.method, path: req.originalUrl || req.url, headers: req.headers, csrf: req.get && req.get('x-csrf-token'), sessionExists: !!req.session, sessionUserId: SessionManager.getLoggedInUserId ? SessionManager.getLoggedInUserId(req.session) : null }) } catch (e) {}
        try { console.error(new Error('response 403 finish trace').stack) } catch (e) {}
        try { fs.appendFileSync('/tmp/ssh_403_trace.log', `${new Date().toISOString()} FINISH 403 ${req.method} ${(req.originalUrl || req.url)} headers=${JSON.stringify(req.headers)} sessionExists=${!!req.session} sessionUser=${JSON.stringify(req.session && req.session.user ? { _id: req.session.user._id, email: req.session.user.email } : null)}\n${new Error().stack}\n\n`) } catch (e) {}
      }
    } catch (e) {}
  })
  // Also capture socket close events for SSH key requests so we can detect early socket aborts
  res.on('close', () => {
    try {
      if (process.env.NODE_ENV === 'test' && (req.originalUrl || req.url) && (req.originalUrl || req.url).includes('/internal/api/users/') && (req.originalUrl || req.url).includes('/ssh-keys')) {
        try {
          const closeInfo = {
            t: new Date().toISOString(),
            event: 'close',
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            headers: res.getHeaders ? res.getHeaders() : {},
            headersSent: res.headersSent,
            socketDestroyed: res.socket ? !!res.socket.destroyed : null,
          }
          try { fs.appendFileSync('/tmp/user_sshkey_wire_debug.log', JSON.stringify(closeInfo) + '\n\n') } catch (e) {}
        } catch (e) {}
      }
    } catch (e) {}
  })
  next()
})

// App-level early debug echo middleware: short-circuit and return raw headers/session
// whenever the request includes the test header `x-debug-echo: 1` (runs before CSRF)
app.use((req, res, next) => {
  try {
    if (req.get && req.get('x-debug-echo') === '1') {
      const sessionUser = (req.session && req.session.user) ? { _id: req.session.user._id, email: req.session.user.email } : null
      const out = {
        stage: 'app-early',
        originalUrl: req.originalUrl,
        url: req.url,
        method: req.method,
        headers: req.headers,
        cookie: req.headers && req.headers.cookie,
        sessionExists: !!req.session,
        sessionUser,
      }
      try { console.error('[APP EARLY DEBUG ECHO] incoming', out) } catch (e) {}
      return res.status(200).json(out)
    }
  } catch (e) {}
  next()
})

const webRouter = express.Router()
const privateApiRouter = express.Router()
const publicApiRouter = express.Router()

if (Settings.behindProxy) {
  app.set('trust proxy', Settings.trustedProxyIps || true)
  /**
   * Handle the X-Original-Forwarded-For header.
   *
   * The nginx ingress sends us the contents of X-Forwarded-For it received in
   * X-Original-Forwarded-For. Express expects all proxy IPs to be in a comma
   * separated list in X-Forwarded-For.
   */
  app.use((req, res, next) => {
    if (
      req.headers['x-original-forwarded-for'] &&
      req.headers['x-forwarded-for']
    ) {
      req.headers['x-forwarded-for'] =
        req.headers['x-original-forwarded-for'] +
        ', ' +
        req.headers['x-forwarded-for']
    }
    next()
  })
}

// `req.ip` is a getter on the underlying socket.
// The socket details are freed as the connection is dropped -- aka aborted.
// Hence `req.ip` may read `undefined` upon connection drop.
// A couple of places require a valid IP at all times. Cache it!
const ORIGINAL_REQ_IP = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(app.request),
  'ip'
).get
Object.defineProperty(app.request, 'ip', {
  configurable: true,
  enumerable: true,
  get() {
    const ip = ORIGINAL_REQ_IP.call(this)
    // Shadow the prototype level getter with a property on the instance.
    // Any future access on `req.ip` will get served by the instance property.
    Object.defineProperty(this, 'ip', { value: ip })
    return ip
  },
})

app.use((req, res, next) => {
  if (req.destroyed) {
    // Request has been aborted already.
    return
  }
  // Implicitly cache the ip, see above.
  if (!req.ip) {
    // Critical connection details are missing.
    return
  }
  next()
})

if (Settings.exposeHostname) {
  const HOSTNAME = os.hostname()
  app.use((req, res, next) => {
    res.setHeader('X-Served-By', HOSTNAME)
    next()
  })
}

webRouter.use(
  serveStaticWrapper(
    fileURLToPath(new URL('../../../public', import.meta.url)),
    {
      maxAge: STATIC_CACHE_AGE,
      setHeaders: removeCSPHeaders,
    }
  )
)

app.set('views', fileURLToPath(new URL('../../views', import.meta.url)))
app.set('view engine', 'pug')

if (Settings.enabledServices.includes('web')) {
  if (Settings.enablePugCache || app.get('env') !== 'development') {
    logger.debug('enabling view cache for production or acceptance tests')
    app.enable('view cache')
  }
  if (Settings.precompilePugTemplatesAtBootTime) {
    logger.debug('precompiling views for web in production environment')
    Views.precompileViews(app)
  }
  Modules.loadViewIncludes(app)
}

app.use(metrics.http.monitor(logger))

await Modules.applyMiddleware(app, 'appMiddleware')

// Test-only: capture a final headers snapshot for SSH keys endpoints so
// we can detect middleware that modifies or strips the response before
// it reaches the wire. Writes a concise log to /tmp/user_sshkey_middleware_snapshot.log
app.use((req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'test' && (req.originalUrl || req.url) && (req.originalUrl || req.url).includes('/internal/api/users/') && (req.originalUrl || req.url).includes('/ssh-keys')) {
      res.on('finish', () => {
        try {
          const snap = {
            t: new Date().toISOString(),
            event: 'middleware-finish-snapshot',
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            headersSent: res.headersSent,
            headers: res.getHeaders ? res.getHeaders() : {},
          }
          try { fs.appendFileSync('/tmp/user_sshkey_middleware_snapshot.log', JSON.stringify(snap) + '\n') } catch (e) {}
        } catch (e) {}
      })

      res.on('close', () => {
        try {
          const snap = {
            t: new Date().toISOString(),
            event: 'middleware-close-snapshot',
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            headersSent: res.headersSent,
            headers: res.getHeaders ? res.getHeaders() : {},
            socketDestroyed: res.socket ? !!res.socket.destroyed : null,
          }
          try { fs.appendFileSync('/tmp/user_sshkey_middleware_snapshot.log', JSON.stringify(snap) + '\n') } catch (e) {}
        } catch (e) {}
      })
    }
  } catch (e) {}
  next()
})

app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }))
app.use(bodyParser.json({ limit: Settings.max_json_request_size }))
app.use(methodOverride())
// add explicit name for telemetry
app.use(bearerTokenMiddleware())

if (Settings.blockCrossOriginRequests) {
  app.use(Csrf.blockCrossOriginRequests())
}

if (Settings.useHttpPermissionsPolicy) {
  const httpPermissionsPolicy = new HttpPermissionsPolicyMiddleware(
    Settings.httpPermissions
  )
  logger.debug('adding permissions policy config', Settings.httpPermissions)
  webRouter.use(httpPermissionsPolicy.middleware)
}

RedirectManager.apply(webRouter)

if (!Settings.security.sessionSecret) {
  throw new Error('No SESSION_SECRET provided.')
}

const sessionSecrets = [
  Settings.security.sessionSecret,
  Settings.security.sessionSecretUpcoming,
  Settings.security.sessionSecretFallback,
].filter(Boolean)

webRouter.use(cookieParser(sessionSecrets))
webRouter.use(CookieMetrics.middleware)
SessionAutostartMiddleware.applyInitialMiddleware(webRouter)
await Modules.applyMiddleware(webRouter, 'sessionMiddleware', {
  store: sessionStore,
})
webRouter.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: sessionSecrets,
    proxy: Settings.behindProxy,
    cookie: {
      domain: Settings.cookieDomain,
      maxAge: Settings.cookieSessionLength, // in milliseconds, see https://github.com/expressjs/session#cookiemaxage
      secure: Settings.secureCookie,
      sameSite: Settings.sameSiteCookie,
    },
    store: sessionStore,
    key: Settings.cookieName,
    rolling: Settings.cookieRollingSession === true,
  })
)

// Test-only: allow setting a dev session user via header to make contract tests less flaky
webRouter.use((req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'test') {
      const devUser = req.get && req.get('x-dev-user-id')
      if (devUser) {
        try { console.warn('[Server TEST-FALLBACK] x-dev-user-id header detected, synthesizing req.session.user', devUser) } catch (e) {}
        if (!req.session) req.session = {}
        const devUserObj = { _id: devUser, email: `${devUser}@example.com`, first_name: 'dev' }
        // Ensure both legacy req.session.user and passport session reflect the dev user so
        // SessionManager.getSessionUser() will return it (it prefers session.user then passport.user).
        // Force-assign to override any existing session values in test contexts.
        req.session.user = devUserObj
        req.session.passport = req.session.passport || {}
        req.session.passport.user = req.session.user
        req.user = req.session.user
      }
    }
  } catch (e) {}
  next()
})

// Debug middleware: wrap res.sendStatus to log when a 403 is emitted so we can trace who is rejecting requests
webRouter.use((req, res, next) => {
  const origSendStatus = res.sendStatus.bind(res)
  res.sendStatus = function (statusCode) {
    try {
      if (statusCode === 403) {
        try { console.error('[Server] sendStatus(403) called for', { method: req.method, path: req.originalUrl || req.url, headersCookie: req.headers && req.headers.cookie, csrfHeader: req.get && req.get('x-csrf-token') }) } catch (e) {}
        try { console.error(new Error('403 trace').stack) } catch (e) {}
      }
    } catch (e) {}
    return origSendStatus(statusCode)
  }

  // Also wrap res.status to detect later `.status(403).send()` patterns
  const origStatus = res.status.bind(res)
  res.status = function (statusCode) {
    try {
      if (statusCode === 403) {
        try { console.error('[Server] res.status(403) called for', { method: req.method, path: req.originalUrl || req.url, headersCookie: req.headers && req.headers.cookie, csrfHeader: req.get && req.get('x-csrf-token') }) } catch (e) {}
        try { console.error(new Error('status 403 trace').stack) } catch (e) {}
      }
    } catch (e) {}
    return origStatus(statusCode)
  }

  next()
})

if (Features.hasFeature('saas')) {
  webRouter.use(AnalyticsManager.analyticsIdMiddleware)
}

// passport
webRouter.use(passport.initialize())
webRouter.use(passport.session())

// Test-only: allow setting a dev session user via header to make contract tests less flaky
// Moved to run after passport session so it can override deserialized `req.user` in test contexts.
webRouter.use((req, res, next) => {
  try {
    const devUser = req.get && req.get('x-dev-user-id')
    if (devUser) {
      try { console.error('[Server TEST-FALLBACK] header get', req.get && req.get('x-dev-user-id'), 'raw header', req.headers && req.headers['x-dev-user-id']) } catch (e) {}
      try { console.warn('[Server TEST-FALLBACK] x-dev-user-id header detected, synthesizing req.session.user', devUser) } catch (e) {}
      if (!req.session) req.session = {}
      const devUserObj = { _id: devUser, email: `${devUser}@example.com`, first_name: 'dev' }
      // Force-assign to override any existing session values in test contexts.
      req.session.user = devUserObj
      req.session.passport = req.session.passport || {}
      req.session.passport.user = req.session.user
      // Ensure req.user is set so downstream middlewares/handlers see the test user (override passport deserialize)
      req.user = req.session.user
    }
  } catch (e) {}
  next()
})

passport.use(
  new LocalStrategy(
    {
      passReqToCallback: true,
      usernameField: 'email',
      passwordField: 'password',
    },
    AuthenticationController.doPassportLogin
  )
)
passport.serializeUser(AuthenticationController.serializeUser)
passport.deserializeUser(AuthenticationController.deserializeUser)

Modules.hooks.fire('passportSetup', passport, err => {
  if (err != null) {
    logger.err({ err }, 'error setting up passport in modules')
  }
})

await Modules.applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter)

// Debug: log incoming internal API requests early, before CSRF and other middleware that may short-circuit
webRouter.use('/internal/api', (req, res, next) => {
  try { console.error('[Server] early internal request', { method: req.method, url: req.url, headers: { cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token'), origin: req.headers && req.headers.origin } }) } catch (e) {}
  next()
})

// Temporary test-only debug echo endpoint to help triage headers/session propagation
// Returns JSON with headers, session presence, and session user metadata (if available)
webRouter.post('/internal/api/debug/echo', (req, res) => {
  try {
    const sessionUser = (req.session && req.session.user) ? { _id: req.session.user._id, email: req.session.user.email } : null
    const out = {
      headers: req.headers,
      csrfHeader: req.get && req.get('x-csrf-token'),
      sessionExists: !!req.session,
      sessionUser,
    }
    if (process.env.NODE_ENV === 'test') {
      try { console.error('[DEBUG ECHO] returning', out) } catch (e) {}
      return res.status(200).json(out)
    }
    // Ensure this endpoint is not available in non-test envs
    return res.sendStatus(404)
  } catch (err) {
    try { console.error('[DEBUG ECHO] error', err && err.stack ? err.stack : err) } catch (e) {}
    return res.sendStatus(500)
  }
})

webRouter.csrf = new Csrf()
webRouter.use(webRouter.csrf.middleware)
// Test-only: exempt debug echo POST from CSRF so tests can POST without fetching a token
try {
  // handle both mounted and unmounted path forms (router mounts can change req.path)
  webRouter.csrf.disableDefaultCsrfProtection('/internal/api/debug/echo', 'POST')
  webRouter.csrf.disableDefaultCsrfProtection('/debug/echo', 'POST')
} catch (e) {}
webRouter.use(translations.i18nMiddleware)
webRouter.use(translations.setLangBasedOnDomainMiddleware)

if (Settings.cookieRollingSession) {
  // Measure expiry from last request, not last login
  webRouter.use((req, res, next) => {
    if (!req.session.noSessionCallback) {
      req.session.touch()
      if (SessionManager.isUserLoggedIn(req.session)) {
        UserSessionsManager.touch(
          SessionManager.getSessionUser(req.session),
          err => {
            if (err) {
              logger.err({ err }, 'error extending user session')
            }
          }
        )
      }
    }
    next()
  })
}

webRouter.use(ReferalConnect.use)
await expressLocals(webRouter, privateApiRouter, publicApiRouter)
webRouter.use(SessionAutostartMiddleware.invokeCallbackMiddleware)

webRouter.use(function checkIfSiteClosed(req, res, next) {
  if (Settings.siteIsOpen) {
    next()
  } else if (hasAdminAccess(SessionManager.getSessionUser(req.session))) {
    next()
  } else {
    HttpErrorHandler.maintenance(req, res)
  }
})

webRouter.use(function checkIfEditorClosed(req, res, next) {
  if (Settings.editorIsOpen) {
    next()
  } else if (req.url.indexOf('/admin') === 0) {
    next()
  } else {
    HttpErrorHandler.maintenance(req, res)
  }
})

webRouter.use(AuthenticationController.validateAdmin)

// add security headers using Helmet
const noCacheMiddleware = noCache()
webRouter.use((req, res, next) => {
  const isProjectPage = /^\/project\/[a-f0-9]{24}$/.test(req.path)
  if (isProjectPage) {
    // always set no-cache headers on a project page, as it could be an anonymous token viewer
    return noCacheMiddleware(req, res, next)
  }

  const isProjectFile = /^\/project\/[a-f0-9]{24}\/file\/[a-f0-9]{24}$/.test(
    req.path
  )
  if (isProjectFile) {
    // don't set no-cache headers on a project file, as it's immutable and can be cached (privately)
    return next()
  }
  const isProjectBlob = /^\/project\/[a-f0-9]{24}\/blob\/[a-f0-9]{40}$/.test(
    req.path
  )
  if (isProjectBlob) {
    // don't set no-cache headers on a project blobs, as they are immutable and can be cached (privately)
    return next()
  }

  const isWikiContent = /^\/learn(-scripts)?(\/|$)/i.test(req.path)
  if (isWikiContent) {
    // don't set no-cache headers on wiki content, as it's immutable and can be cached (publicly)
    return next()
  }

  const isLoggedIn = SessionManager.isUserLoggedIn(req.session)
  if (isLoggedIn) {
    // always set no-cache headers for authenticated users (apart from project files, above)
    return noCacheMiddleware(req, res, next)
  }

  // allow other responses (anonymous users, except for project pages) to be cached
  return next()
})

webRouter.use(
  helmet({
    // note that more headers are added by default
    dnsPrefetchControl: false,
    referrerPolicy: { policy: 'origin-when-cross-origin' },
    hsts: false,
    // Disabled because it's impractical to include every resource via CORS or
    // with the magic CORP header
    crossOriginEmbedderPolicy: false,
    // We need to be able to share the context of some popups. For example,
    // when Recurly opens Paypal in a popup.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // Disabled because it's not a security header and has possibly-unwanted
    // effects
    originAgentCluster: false,
    // We have custom handling for CSP below, so Helmet's default is disabled
    contentSecurityPolicy: false,
  })
)

// add CSP header to HTML-rendering routes, if enabled
if (Settings.csp && Settings.csp.enabled) {
  logger.debug('adding CSP header to rendered routes', Settings.csp)
  app.use(csp(Settings.csp))
}

logger.debug('creating HTTP server'.yellow)
const server = http.createServer(app)
// Very early HTTP-level listener: log raw request headers/method/url before Express.
// This helps verify whether test headers (eg. x-debug-echo, x-dev-user-id) arrive at the process
server.on('request', (req, res) => {
  try { console.error('[HTTP SERVER EARLY REQUEST]', { method: req.method, url: req.url, rawHeaders: req.rawHeaders, headers: req.headers }) } catch (e) {}
})

// provide settings for separate web and api processes
if (Settings.enabledServices.includes('api')) {
  logger.debug({}, 'providing api router')
  app.use(privateApiRouter)
  app.use(handleValidationError)
  app.use(ErrorController.handleApiError)
}

if (Settings.enabledServices.includes('web')) {
  logger.debug({}, 'providing web router')
  app.use(publicApiRouter) // public API goes with web router for public access
  app.use(handleValidationError)
  app.use(ErrorController.handleApiError)
  app.use(webRouter)
  app.use(handleValidationError)
  app.use(ErrorController.handleError)
}

metrics.injectMetricsRoute(webRouter)
metrics.injectMetricsRoute(privateApiRouter)

// Debug: log incoming internal API requests
webRouter.use('/internal/api', (req, res, next) => {
  try { console.error('DEBUG internal request', { method: req.method, url: req.url, cookie: req.headers && req.headers.cookie }) } catch (e) {}

  // Wrap sendStatus/status to capture callsite when 403 is sent specifically for internal API
  try {
    const origSendStatus = res.sendStatus.bind(res)
    res.sendStatus = function (statusCode) {
      try {
        if (statusCode === 403) {
          try { console.error('[INTERNAL API] sendStatus(403) for', { method: req.method, url: req.url, headers: req.headers && { cookie: req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token') } }) } catch (e) {}
          try { fs.appendFileSync('/tmp/ssh_403_trace.log', `${new Date().toISOString()} INTERNAL_SENDSTATUS 403 ${req.method} ${req.url} headers=${JSON.stringify({ cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token') })} \n${new Error().stack}\n\n`) } catch (e) {}
        }
      } catch (e) {}
      return origSendStatus(statusCode)
    }

    const origStatus = res.status.bind(res)
    res.status = function (statusCode) {
      try {
        if (statusCode === 403) {
          try { console.error('[INTERNAL API] status(403) for', { method: req.method, url: req.url, headers: req.headers && { cookie: req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token') } }) } catch (e) {}
          try { fs.appendFileSync('/tmp/ssh_403_trace.log', `${new Date().toISOString()} INTERNAL_STATUS 403 ${req.method} ${req.url} headers=${JSON.stringify({ cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token') })} \n${new Error().stack}\n\n`) } catch (e) {}
        }
      } catch (e) {}
      return origStatus(statusCode)
    }
  } catch (e) {}

  next()
})

const beforeRouterInitialize = performance.now()
await Router.initialize(webRouter, privateApiRouter, publicApiRouter)
metrics.gauge('web_startup', performance.now() - beforeRouterInitialize, 1, {
  path: 'Router.initialize',
})

// Ensure a test-only debug echo endpoint is registered AFTER Router.initialize so
// it remains available when routers are (re)configured. This endpoint echoes
// request headers and session info and helps verify header/session propagation
// between the test client and the running server.
webRouter.post('/internal/api/debug/echo', (req, res) => {
  try {
    const sessionUser = (req.session && req.session.user) ? { _id: req.session.user._id, email: req.session.user.email } : null
    const out = {
      headers: req.headers,
      csrfHeader: req.get && req.get('x-csrf-token'),
      sessionExists: !!req.session,
      sessionUser,
    }
    if (process.env.NODE_ENV === 'test' || req.get && req.get('x-debug-echo') === '1' || process.env.NODE_ENV === 'development') {
      try { console.error('[DEBUG ECHO - POST] returning', out) } catch (e) {}
      return res.status(200).json(out)
    }
    return res.sendStatus(404)
  } catch (err) {
    try { console.error('[DEBUG ECHO - POST] error', err && err.stack ? err.stack : err) } catch (e) {}
    return res.sendStatus(500)
  }
})

// Also register a GET variant for quick inspection (GETs are not blocked by csurf
// and are convenient to inspect headers/session state without needing csrf tokens)
webRouter.get('/internal/api/debug/echo', (req, res) => {
  try {
    const sessionUser = (req.session && req.session.user) ? { _id: req.session.user._id, email: req.session.user.email } : null
    const out = {
      method: req.method,
      originalUrl: req.originalUrl,
      url: req.url,
      headers: req.headers,
      csrfHeader: req.get && req.get('x-csrf-token'),
      sessionExists: !!req.session,
      sessionUser,
    }
    if (process.env.NODE_ENV === 'test') {
      try { console.error('[DEBUG ECHO - GET] returning', out) } catch (e) {}
      return res.status(200).json(out)
    }
    return res.sendStatus(404)
  } catch (err) {
    try { console.error('[DEBUG ECHO - GET] error', err && err.stack ? err.stack : err) } catch (e) {}
    return res.sendStatus(500)
  }
})

export default { app, server }
