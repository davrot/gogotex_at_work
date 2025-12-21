import AdminController from './Features/ServerAdmin/AdminController.mjs'
import TokenReissueController from './Features/Admin/TokenReissueController.mjs'
import ErrorController from './Features/Errors/ErrorController.mjs'
import Features from './infrastructure/Features.js'
import ProjectController from './Features/Project/ProjectController.mjs'
import ProjectApiController from './Features/Project/ProjectApiController.mjs'
import ProjectListController from './Features/Project/ProjectListController.mjs'
import SpellingController from './Features/Spelling/SpellingController.mjs'
import EditorRouter from './Features/Editor/EditorRouter.mjs'
import Settings from '@overleaf/settings'
import TpdsController from './Features/ThirdPartyDataStore/TpdsController.mjs'
import SubscriptionRouter from './Features/Subscription/SubscriptionRouter.mjs'
import UploadsRouter from './Features/Uploads/UploadsRouter.mjs'
import metrics from '@overleaf/metrics'
import ReferalController from './Features/Referal/ReferalController.mjs'
import AuthenticationController from './Features/Authentication/AuthenticationController.mjs'
import PermissionsController from './Features/Authorization/PermissionsController.mjs'
import SessionManager from './Features/Authentication/SessionManager.mjs'
import TagsController from './Features/Tags/TagsController.mjs'
import NotificationsController from './Features/Notifications/NotificationsController.mjs'
import CollaboratorsRouter from './Features/Collaborators/CollaboratorsRouter.mjs'
import UserInfoController from './Features/User/UserInfoController.mjs'
import UserController from './Features/User/UserController.mjs'
import UserEmailsController from './Features/User/UserEmailsController.mjs'
import UserPagesController from './Features/User/UserPagesController.mjs'
import UserSSHKeysController from './Features/User/UserSSHKeysController.mjs'
import TutorialController from './Features/Tutorial/TutorialController.mjs'
import DocumentController from './Features/Documents/DocumentController.mjs'
import CompileManager from './Features/Compile/CompileManager.mjs'
import CompileController from './Features/Compile/CompileController.mjs'
import HealthCheckController from './Features/HealthCheck/HealthCheckController.mjs'
import ProjectDownloadsController from './Features/Downloads/ProjectDownloadsController.mjs'
import FileStoreController from './Features/FileStore/FileStoreController.mjs'
import DocumentUpdaterController from './Features/DocumentUpdater/DocumentUpdaterController.mjs'
import HistoryRouter from './Features/History/HistoryRouter.mjs'
import ExportsController from './Features/Exports/ExportsController.mjs'
import PasswordResetRouter from './Features/PasswordReset/PasswordResetRouter.mjs'
import StaticPagesRouter from './Features/StaticPages/StaticPagesRouter.mjs'
import ChatController from './Features/Chat/ChatController.mjs'
import Modules from './infrastructure/Modules.js'
import {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
} from './infrastructure/RateLimiter.js'
import RateLimiterMiddleware from './Features/Security/RateLimiterMiddleware.mjs'
import InactiveProjectController from './Features/InactiveData/InactiveProjectController.mjs'
import ContactRouter from './Features/Contacts/ContactRouter.mjs'
import ReferencesController from './Features/References/ReferencesController.mjs'
import AuthorizationMiddleware from './Features/Authorization/AuthorizationMiddleware.mjs'
import BetaProgramController from './Features/BetaProgram/BetaProgramController.mjs'
import AnalyticsRouter from './Features/Analytics/AnalyticsRouter.mjs'
import MetaController from './Features/Metadata/MetaController.mjs'
import TokenAccessController from './Features/TokenAccess/TokenAccessController.mjs'
import TokenAccessRouter from './Features/TokenAccess/TokenAccessRouter.mjs'
import TokenRouter from './Features/Token/TokenRouter.mjs'
import TokenController from './Features/Token/TokenController.mjs'
import DiscoveryRouter from './Features/Discovery/DiscoveryRouter.mjs'
import LinkedFilesRouter from './Features/LinkedFiles/LinkedFilesRouter.mjs'
import TemplatesRouter from './Features/Templates/TemplatesRouter.mjs'
import UserMembershipRouter from './Features/UserMembership/UserMembershipRouter.mjs'
import SystemMessageController from './Features/SystemMessages/SystemMessageController.mjs'
import AnalyticsRegistrationSourceMiddleware from './Features/Analytics/AnalyticsRegistrationSourceMiddleware.mjs'
import AnalyticsUTMTrackingMiddleware from './Features/Analytics/AnalyticsUTMTrackingMiddleware.mjs'
import CaptchaMiddleware from './Features/Captcha/CaptchaMiddleware.mjs'
import UnsupportedBrowserMiddleware from './infrastructure/UnsupportedBrowserMiddleware.mjs'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { plainTextResponse } from './infrastructure/Response.js'
import SocketDiagnostics from './Features/SocketDiagnostics/SocketDiagnostics.mjs'
import ClsiCacheController from './Features/Compile/ClsiCacheController.mjs'
import AsyncLocalStorage from './infrastructure/AsyncLocalStorage.js'

const { renderUnsupportedBrowserPage, unsupportedBrowserMiddleware } =
  UnsupportedBrowserMiddleware

const rateLimiters = {
  addEmail: new RateLimiter('add-email', {
    points: 10,
    duration: 60,
  }),
  addProjectToTag: new RateLimiter('add-project-to-tag', {
    points: 30,
    duration: 60,
  }),
  addProjectsToTag: new RateLimiter('add-projects-to-tag', {
    points: 30,
    duration: 60,
  }),
  canSkipCaptcha: new RateLimiter('can-skip-captcha', {
    points: 20,
    duration: 60,
  }),
  changePassword: new RateLimiter('change-password', {
    points: 10,
    duration: 60,
  }),
  compileProjectHttp: new RateLimiter('compile-project-http', {
    points: 800,
    duration: 60 * 60,
  }),
  confirmEmail: new RateLimiter('confirm-email', {
    points: 10,
    duration: 60,
  }),
  createProject: new RateLimiter('create-project', {
    points: 20,
    duration: 60,
  }),
  createTag: new RateLimiter('create-tag', {
    points: 30,
    duration: 60,
  }),
  deleteEmail: new RateLimiter('delete-email', {
    points: 10,
    duration: 60,
  }),
  deleteTag: new RateLimiter('delete-tag', {
    points: 30,
    duration: 60,
  }),
  deleteUser: new RateLimiter('delete-user', {
    points: 10,
    duration: 60,
  }),
  endorseEmail: new RateLimiter('endorse-email', {
    points: 30,
    duration: 60,
  }),
  getProjects: new RateLimiter('get-projects', {
    points: 30,
    duration: 60,
  }),
  grantTokenAccessReadOnly: new RateLimiter('grant-token-access-read-only', {
    points: 10,
    duration: 60,
  }),
  grantTokenAccessReadWrite: new RateLimiter('grant-token-access-read-write', {
    points: 10,
    duration: 60,
  }),
  indexAllProjectReferences: new RateLimiter('index-all-project-references', {
    points: 30,
    duration: 60,
  }),
  miscOutputDownload: new RateLimiter('misc-output-download', {
    points: 1000,
    duration: 60 * 60,
  }),
  multipleProjectsZipDownload: new RateLimiter(
    'multiple-projects-zip-download',
    {
      points: 10,
      duration: 60,
    }
  ),
  openDashboard: new RateLimiter('open-dashboard', {
    points: 30,
    duration: 60,
  }),
  readAndWriteToken: new RateLimiter('read-and-write-token', {
    points: 15,
    duration: 60,
  }),
  readOnlyToken: new RateLimiter('read-only-token', {
    points: 15,
    duration: 60,
  }),
  removeProjectFromTag: new RateLimiter('remove-project-from-tag', {
    points: 30,
    duration: 60,
  }),
  removeProjectsFromTag: new RateLimiter('remove-projects-from-tag', {
    points: 30,
    duration: 60,
  }),
  renameTag: new RateLimiter('rename-tag', {
    points: 30,
    duration: 60,
  }),
  resendConfirmation: new RateLimiter('resend-confirmation', {
    points: 1,
    duration: 60,
  }),
  sendConfirmation: new RateLimiter('send-confirmation', {
    points: 2,
    duration: 60,
  }),
  sendChatMessage: new RateLimiter('send-chat-message', {
    points: 100,
    duration: 60,
  }),
  statusCompiler: new RateLimiter('status-compiler', {
    points: 10,
    duration: 60,
  }),
  zipDownload: new RateLimiter('zip-download', {
    points: 10,
    duration: 60,
  }),
  fingerprintLookup: new RateLimiter('fingerprint-lookup', { points: 60, duration: 60 }),
  cacheInvalidate: new RateLimiter('cache-invalidate', { points: 60, duration: 60 }),

}

async function initialize(webRouter, privateApiRouter, publicApiRouter) {
  webRouter.use(unsupportedBrowserMiddleware)

  // Debug: log all incoming DELETE requests to aid in diagnosing missing route handling
  webRouter.use((req, res, next) => {
    try {
      if (req && req.method === 'DELETE') {
        console.error('[GLOBAL ROUTE DEBUG] incoming DELETE', { method: req.method, url: req.originalUrl || req.url, headers: { cookie: req.headers && req.headers.cookie, 'x-service-origin': req.headers && req.headers['x-service-origin'] }, sessionExists: !!req.session, sessionUserId: req.session && req.session.user && req.session.user._id ? req.session.user._id : null })
      }
    } catch (e) {}
    return next()
  })

  if (!Settings.allowPublicAccess) {
    webRouter.all('*', AuthenticationController.requireGlobalLogin)
  }

  webRouter.get('*', AnalyticsRegistrationSourceMiddleware.setInbound())
  webRouter.get('*', AnalyticsUTMTrackingMiddleware.recordUTMTags())

  // Mount onto /login in order to get the deviceHistory cookie.
  webRouter.post(
    '/login/can-skip-captcha',
    // Keep in sync with the overleaf-login options.
    RateLimiterMiddleware.rateLimit(rateLimiters.canSkipCaptcha),
    CaptchaMiddleware.canSkipCaptcha
  )

  // DEBUG CATCHALL: log any request under /internal/api/users/:userId to diagnose missing DELETE routing
  webRouter.all('/internal/api/users/:userId/*', (req, res, next) => {
    try { console.error('[CATCHALL DEBUG] incoming', { method: req.method, url: req.originalUrl || req.url, path: req.path, headers: { cookie: req.headers && req.headers.cookie, 'x-service-origin': req.headers && req.headers['x-service-origin'] }, sessionExists: !!req.session, sessionUserId: req.session && req.session.user && req.session.user._id ? req.session.user._id : null }) } catch (e) {}
    return next()
  })

  webRouter.get('/login', UserPagesController.loginPage)
  AuthenticationController.addEndpointToLoginWhitelist('/login')

  webRouter.post(
    '/login',
    RateLimiterMiddleware.rateLimit(overleafLoginRateLimiter), // rate limit IP (20 / 60s)
    RateLimiterMiddleware.loginRateLimitEmail(), // rate limit email (10 / 120s)
    CaptchaMiddleware.validateCaptcha('login'),
    AuthenticationController.passportLogin
  )

  webRouter.get(
    '/compromised-password',
    AuthenticationController.requireLogin(),
    UserPagesController.compromisedPasswordPage
  )

  webRouter.get('/account-suspended', UserPagesController.accountSuspended)

  webRouter.get(
    '/socket-diagnostics',
    AuthenticationController.requireLogin(),
    SocketDiagnostics.index
  )

  if (Settings.enableLegacyLogin) {
    AuthenticationController.addEndpointToLoginWhitelist('/login/legacy')
    webRouter.get('/login/legacy', UserPagesController.loginPage)
    webRouter.post(
      '/login/legacy',
      RateLimiterMiddleware.rateLimit(overleafLoginRateLimiter), // rate limit IP (20 / 60s)
      RateLimiterMiddleware.loginRateLimitEmail(), // rate limit email (10 / 120s)
      CaptchaMiddleware.validateCaptcha('login'),
      AuthenticationController.passportLogin
    )
  }

  webRouter.get(
    '/read-only/one-time-login',
    UserPagesController.oneTimeLoginPage
  )
  AuthenticationController.addEndpointToLoginWhitelist(
    '/read-only/one-time-login'
  )

  webRouter.post('/logout', UserController.logout)

  webRouter.get('/restricted', AuthorizationMiddleware.restricted)

  if (Features.hasFeature('registration-page')) {
    webRouter.get('/register', UserPagesController.registerPage)
    AuthenticationController.addEndpointToLoginWhitelist('/register')
  }

  EditorRouter.apply(webRouter, privateApiRouter)
  CollaboratorsRouter.apply(webRouter, privateApiRouter)
  SubscriptionRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  UploadsRouter.apply(webRouter, privateApiRouter)
  PasswordResetRouter.apply(webRouter, privateApiRouter)
  StaticPagesRouter.apply(webRouter, privateApiRouter)
  ContactRouter.apply(webRouter, privateApiRouter)
  AnalyticsRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  LinkedFilesRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  TemplatesRouter.apply(webRouter)
  UserMembershipRouter.apply(webRouter)
  TokenAccessRouter.apply(webRouter)
  // Token management (user git tokens)
  TokenRouter.apply(webRouter)

  DiscoveryRouter.apply(webRouter, privateApiRouter)
  HistoryRouter.apply(webRouter, privateApiRouter)

  await Modules.applyRouter(webRouter, privateApiRouter, publicApiRouter)

  if (Settings.enableSubscriptions) {
    webRouter.get(
      '/user/bonus',
      AuthenticationController.requireLogin(),
      ReferalController.bonus
    )
  }

  // .getMessages will generate an empty response for anonymous users.
  webRouter.get('/system/messages', SystemMessageController.getMessages)

  webRouter.get(
    '/user/settings',
    AuthenticationController.requireLogin(),
    PermissionsController.useCapabilities(),
    UserPagesController.settingsPage
  )
  webRouter.post(
    '/user/settings',
    AuthenticationController.requireLogin(),
    UserController.updateUserSettings
  )

  // User SSH Keys: list, create, delete (internal/user-facing)
  // internal form (explicit user id) - controller enforces admin access when acting on other users
  webRouter.get('/internal/api/users/:userId/ssh-keys', AuthenticationController.requireLogin(), UserSSHKeysController.list)
  webRouter.post('/internal/api/users/:userId/ssh-keys', (req, res, next) => { try { console.error('[ROUTE DEBUG] /internal/api/users/:userId/ssh-keys incoming', { method: req.method, url: req.originalUrl || req.url, headers: { cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token'), 'x-dev-user-id': req.get && req.get('x-dev-user-id') }, sessionExists: !!req.session, sessionUserId: req.session && req.session.user && req.session.user._id ? req.session.user._id : null }) } catch (e) {} next() }, AuthenticationController.requireLogin(), UserSSHKeysController.create)

  // Test-only: add a CSRF-exempt GET debug echo to inspect headers/session without triggering csurf
  try {
    webRouter.csrf && webRouter.csrf.disableDefaultCsrfProtection && webRouter.csrf.disableDefaultCsrfProtection('/internal/api/debug/echo', 'GET')
    webRouter.get('/internal/api/debug/echo', (req, res) => {
      try { console.error('[ROUTE DEBUG] /internal/api/debug/echo incoming', { method: req.method, url: req.originalUrl || req.url, headers: { cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token'), 'x-dev-user-id': req.get && req.get('x-dev-user-id') }, sessionExists: !!req.session, sessionUserId: req.session && req.session.user && req.session.user._id ? req.session.user._id : null }) } catch (e) {}
      res.json({ ok: true, headers: { cookie: req.headers && req.headers.cookie, 'x-csrf-token': req.get && req.get('x-csrf-token'), 'x-dev-user-id': req.get && req.get('x-dev-user-id') }, sessionExists: !!req.session, sessionUser: req.session && req.session.user ? req.session.user : null })
    })
  } catch (e) {}
  webRouter.delete('/internal/api/users/:userId/ssh-keys/:keyId', AuthenticationController.requireLogin(), UserSSHKeysController.remove)

  // Test-only debug: echo headers/session for internal API triage
  try { console.error('[ROUTER INIT] registering /internal/api/debug/echo') } catch (e) {}

  // Backwards-compatible debug route to allow test harnesses to toggle rate limits
  try { console.error('[ROUTER INIT] registering /internal/api/debug/disable-rate-limits') } catch (e) {}
  webRouter.post('/internal/api/debug/disable-rate-limits', (req, res) => {
    try {
      const fs = require('fs')
      try { fs.writeFileSync('/tmp/disable-rate-limits', '1') } catch (e) {}
      process.env.DISABLE_RATE_LIMITS = 'true'
      try { const Settings = require('@overleaf/settings'); Settings.disableRateLimits = true } catch (e) {}
      try { console.debug('[ROUTER DEBUG] disabled rate limits (debug endpoint)') } catch (e) {}
      return res.status(200).json({ ok: true })
    } catch (err) {
      try { console.error('[ROUTER DEBUG] disable-rate-limits error', err && err.stack ? err.stack : err) } catch (e) {}
      return res.sendStatus(500)
    }
  })

  webRouter.post('/internal/api/debug/echo', (req, res) => {
    try {
      const sessionUser = (req.session && req.session.user) ? { _id: req.session.user._id, email: req.session.user.email } : null
      const out = {
        headers: req.headers,
        csrfHeader: req.get && req.get('x-csrf-token'),
        sessionExists: !!req.session,
        sessionUser,
      }
      if (process.env.NODE_ENV === 'test' || (req.get && req.get('x-debug-echo') === '1') || process.env.NODE_ENV === 'development') {
        try { console.error('[ROUTER DEBUG ECHO] returning', out) } catch (e) {}
        return res.status(200).json(out)
      }
      return res.sendStatus(404)
    } catch (err) {
      try { console.error('[ROUTER DEBUG ECHO] error', err && err.stack ? err.stack : err) } catch (e) {}
      return res.sendStatus(500)
    }
  })

  // Test-only endpoint to toggle rate limiting in the running web process. This makes
  // it possible for the test harness to disable rate-limiting behavior even when the
  // container was started without DISABLE_RATE_LIMITS set. Only active in test mode.
  try { console.error('[ROUTER INIT] registering /internal/api/test/disable-rate-limits') } catch (e) {}
  webRouter.post('/internal/api/test/disable-rate-limits', async (req, res) => {
    // Allow tests and non-production environments to toggle rate-limits at runtime.
    if (process.env.NODE_ENV === 'production') return res.sendStatus(404)
    try {
      try {
        const fs = (await import('fs')).promises ? (await import('fs')) : await import('fs')
        // Use synchronous write to make change visible immediately
        const syncFs = await import('node:fs')
        try { syncFs.writeFileSync('/tmp/disable-rate-limits', '1') } catch (e) {}
      } catch (e) {}
      process.env.DISABLE_RATE_LIMITS = 'true'
      try {
        const SettingsModule = await import('@overleaf/settings')
        const Settings = SettingsModule && (SettingsModule.default || SettingsModule)
        Settings.disableRateLimits = true
      } catch (e) {}
      try { console.debug('[ROUTER TEST] disabled rate limits (test/dev)') } catch (e) {}
      return res.status(200).json({ ok: true })
    } catch (err) {
      try { console.error('[ROUTER TEST] disable-rate-limits error', err && err.stack ? err.stack : err) } catch (e) {}
      return res.sendStatus(500)
    }
  })

  webRouter.post('/internal/api/test/enable-rate-limits', (req, res) => {
    if (process.env.NODE_ENV !== 'test') return res.sendStatus(404)
    try {
      const fs = require('fs')
      try { fs.unlinkSync('/tmp/disable-rate-limits') } catch (e) {}
      process.env.DISABLE_RATE_LIMITS = undefined
      try { const Settings = require('@overleaf/settings'); Settings.disableRateLimits = false } catch (e) {}
      try { console.debug('[ROUTER TEST] enabled rate limits (test-only)') } catch (e) {}
      return res.status(200).json({ ok: true })
    } catch (err) {
      try { console.error('[ROUTER TEST] enable-rate-limits error', err && err.stack ? err.stack : err) } catch (e) {}
      return res.sendStatus(500)
    }
  })

  // User-facing endpoints for managing your own SSH keys (same protection as /user/settings)
  webRouter.get('/user/ssh-keys', AuthenticationController.requireLogin(), UserSSHKeysController.list)
  webRouter.post('/user/ssh-keys', AuthenticationController.requireLogin(), UserSSHKeysController.create)
  webRouter.delete('/user/ssh-keys/:keyId', AuthenticationController.requireLogin(), UserSSHKeysController.remove)
  webRouter.post(
    '/user/password/update',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.changePassword),
    PermissionsController.requirePermission('change-password'),
    UserController.changePassword
  )
  webRouter.get(
    '/user/emails',
    AuthenticationController.requireLogin(),
    AsyncLocalStorage.middleware,
    PermissionsController.useCapabilities(),
    UserController.ensureAffiliationMiddleware,
    UserEmailsController.list
  )
  webRouter.get(
    '/user/emails/confirm',
    AuthenticationController.requireLogin(),
    UserEmailsController.showConfirm
  )
  webRouter.post(
    '/user/emails/confirm',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.confirmEmail),
    UserEmailsController.confirm
  )

  webRouter.post(
    '/user/emails/send-confirmation-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.sendConfirmation),
    await Modules.middleware('confirmationEmailMiddleware'),
    UserEmailsController.sendExistingEmailConfirmationCode
  )

  webRouter.post(
    '/user/emails/resend-confirmation-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.resendConfirmation),
    UserEmailsController.resendExistingSecondaryEmailConfirmationCode
  )

  webRouter.post(
    '/user/emails/confirm-code',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.confirmEmail),
    UserEmailsController.checkExistingEmailConfirmationCode
  )

  webRouter.get(
    '/user/emails/primary-email-check',
    AuthenticationController.requireLogin(),
    UserEmailsController.primaryEmailCheckPage
  )

  webRouter.post(
    '/user/emails/primary-email-check',
    AuthenticationController.requireLogin(),
    PermissionsController.useCapabilities(),
    UserEmailsController.primaryEmailCheck
  )

  if (Features.hasFeature('affiliations')) {
    webRouter.post(
      '/user/emails/delete',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.deleteEmail),
      await Modules.middleware('userDeleteEmail'),
      UserEmailsController.remove
    )
    webRouter.post(
      '/user/emails/default',
      AuthenticationController.requireLogin(),
      UserEmailsController.setDefault
    )
    webRouter.post(
      '/user/emails/endorse',
      AuthenticationController.requireLogin(),
      PermissionsController.requirePermission('endorse-email'),
      RateLimiterMiddleware.rateLimit(rateLimiters.endorseEmail),
      UserEmailsController.endorse
    )
  }

  if (Features.hasFeature('saas')) {
    webRouter.get(
      '/user/emails/add-secondary',
      AuthenticationController.requireLogin(),
      PermissionsController.requirePermission('add-secondary-email'),
      UserEmailsController.addSecondaryEmailPage
    )

    webRouter.get(
      '/user/emails/confirm-secondary',
      AuthenticationController.requireLogin(),
      PermissionsController.requirePermission('add-secondary-email'),
      UserEmailsController.confirmSecondaryEmailPage
    )
  }

  webRouter.get(
    '/user/sessions',
    AuthenticationController.requireLogin(),
    UserPagesController.sessionsPage
  )
  webRouter.post(
    '/user/sessions/clear',
    AuthenticationController.requireLogin(),
    UserController.clearSessions
  )

  // deprecated
  webRouter.delete(
    '/user/newsletter/unsubscribe',
    AuthenticationController.requireLogin(),
    UserController.unsubscribe
  )

  webRouter.post(
    '/user/newsletter/unsubscribe',
    AuthenticationController.requireLogin(),
    UserController.unsubscribe
  )

  webRouter.post(
    '/user/newsletter/subscribe',
    AuthenticationController.requireLogin(),
    UserController.subscribe
  )

  webRouter.get(
    '/user/email-preferences',
    AuthenticationController.requireLogin(),
    UserPagesController.emailPreferencesPage
  )

  webRouter.post(
    '/user/delete',
    RateLimiterMiddleware.rateLimit(rateLimiters.deleteUser),
    AuthenticationController.requireLogin(),
    PermissionsController.requirePermission('delete-own-account'),
    UserController.tryDeleteUser
  )

  webRouter.get(
    '/user/personal_info',
    AuthenticationController.requireLogin(),
    UserInfoController.getLoggedInUsersPersonalInfo
  )
  privateApiRouter.get(
    '/user/:user_id/personal_info',
    AuthenticationController.requirePrivateApiAuth(),
    UserInfoController.getPersonalInfo
  )
  webRouter.get(
    '/user/features',
    AuthenticationController.requireLogin(),
    UserInfoController.getUserFeatures
  )

  webRouter.get(
    '/user/reconfirm',
    UserPagesController.renderReconfirmAccountPage
  )
  // for /user/reconfirm POST, see password router

  webRouter.get(
    '/user/tpds/queues',
    AuthenticationController.requireLogin(),
    TpdsController.getQueues
  )

  webRouter.post(
    '/tutorial/:tutorialKey/complete',
    AuthenticationController.requireLogin(),
    TutorialController.completeTutorial
  )

  webRouter.post(
    '/tutorial/:tutorialKey/postpone',
    AuthenticationController.requireLogin(),
    TutorialController.postponeTutorial
  )

  webRouter.get(
    '/user/projects',
    AuthenticationController.requireLogin(),
    ProjectController.userProjectsJson
  )
  webRouter.get(
    '/project/:Project_id/entities',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.projectEntitiesJson
  )

  webRouter.get(
    '/project',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.openDashboard),
    AsyncLocalStorage.middleware,
    await Modules.middleware('domainCaptureTestSession'),
    PermissionsController.useCapabilities(),
    ProjectListController.projectListPage
  )
  webRouter.post(
    '/project/new',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.createProject),
    ProjectController.newProject
  )
  webRouter.post(
    '/api/project',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjects),
    ProjectListController.getProjectsJson
  )

  for (const route of [
    // Keep the old route for continuous metrics
    '/Project/:Project_id',
    // New route for pdf-detach
    '/Project/:Project_id/:detachRole(detacher|detached)',
  ]) {
    webRouter.get(
      route,
      RateLimiterMiddleware.rateLimit(openProjectRateLimiter, {
        params: ['Project_id'],
      }),
      AsyncLocalStorage.middleware,
      PermissionsController.useCapabilities(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      ProjectController.loadEditor
    )
  }
  webRouter.head(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFileHead
  )
  webRouter.get(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFile
  )

  webRouter.get(
    '/Project/:Project_id/doc/:Doc_id/download', // "download" suffix to avoid conflict with private API route at doc/:doc_id
    AuthorizationMiddleware.ensureUserCanReadProject,
    DocumentUpdaterController.getDoc
  )
  webRouter.post(
    '/project/:Project_id/settings',
    AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
    ProjectController.updateProjectSettings
  )
  webRouter.post(
    '/project/:Project_id/settings/admin',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.updateProjectAdminSettings
  )

  webRouter.post(
    '/project/:Project_id/compile',
    RateLimiterMiddleware.rateLimit(rateLimiters.compileProjectHttp, {
      params: ['Project_id'],
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.compile
  )

  webRouter.post(
    '/project/:Project_id/compile/stop',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.stopCompile
  )

  webRouter.get(
    '/project/:Project_id/output/cached/output.overleaf.json',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.getLatestBuildFromCache
  )

  webRouter.get(
    '/download/project/:Project_id/build/:buildId/output/cached/:filename',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.downloadFromCache
  )

  // PDF Download button for specific build
  webRouter.get(
    '/download/project/:Project_id/build/:build_id/output/output.pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // Align with limits defined in CompileController.downloadPdf
  const rateLimiterMiddlewareOutputFiles = RateLimiterMiddleware.rateLimit(
    rateLimiters.miscOutputDownload,
    { params: ['Project_id'] }
  )

  // direct url access to output files for a specific build
  webRouter.get(
    /^\/project\/([^/]*)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function (req, res, next) {
      const params = {
        Project_id: req.params[0],
        build_id: req.params[1],
        file: req.params[2],
      }
      req.params = params
      next()
    },
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  // direct url access to output files for a specific user and build
  webRouter.get(
    /^\/project\/([^/]*)\/user\/([0-9a-f]+)\/build\/([0-9a-f-]+)\/output\/(.*)$/,
    function (req, res, next) {
      const params = {
        Project_id: req.params[0],
        user_id: req.params[1],
        build_id: req.params[2],
        file: req.params[3],
      }
      req.params = params
      next()
    },
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  webRouter.delete(
    '/project/:Project_id/output',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.deleteAuxFiles
  )
  webRouter.get(
    '/project/:Project_id/sync/code',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncCode
  )
  webRouter.get(
    '/project/:Project_id/sync/pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncPdf
  )
  webRouter.get(
    '/project/:Project_id/wordcount',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.wordCount
  )

  webRouter.post(
    '/Project/:Project_id/archive',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.archiveProject
  )
  webRouter.delete(
    '/Project/:Project_id/archive',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.unarchiveProject
  )
  webRouter.post(
    '/project/:project_id/trash',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.trashProject
  )
  webRouter.delete(
    '/project/:project_id/trash',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.untrashProject
  )

  webRouter.delete(
    '/Project/:Project_id',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.deleteProject
  )

  webRouter.post(
    '/Project/:Project_id/restore',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.restoreProject
  )
  webRouter.post(
    '/Project/:Project_id/clone',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.cloneProject
  )

  webRouter.post(
    '/project/:Project_id/rename',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.renameProject
  )
  webRouter.post(
    '/project/:project_id/export/:brand_variation_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportProject
  )
  webRouter.get(
    '/project/:project_id/export/:export_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportStatus
  )
  webRouter.get(
    '/project/:project_id/export/:export_id/:type',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportDownload
  )

  webRouter.get(
    '/Project/:Project_id/download/zip',
    RateLimiterMiddleware.rateLimit(rateLimiters.zipDownload, {
      params: ['Project_id'],
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectDownloadsController.downloadProject
  )
  webRouter.get(
    '/project/download/zip',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.multipleProjectsZipDownload),
    AuthorizationMiddleware.ensureUserCanReadMultipleProjects,
    ProjectDownloadsController.downloadMultipleProjects
  )

  webRouter.get(
    '/project/:project_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.getMetadata
  )
  webRouter.post(
    '/project/:project_id/doc/:doc_id/metadata',
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.broadcastMetadataForDoc
  )
  privateApiRouter.post(
    '/internal/expire-deleted-projects-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProjectsAfterDuration
  )

  // Cache invalidation API (synchronous hook for urgent invalidation requests)
  privateApiRouter.post(
    '/internal/api/cache/invalidate',
    AuthenticationController.requirePrivateApiAuth(),
    RateLimiterMiddleware.rateLimit(rateLimiters.cacheInvalidate),
    (await import('./routes/cacheInvalidate.mjs')).default
  )

  privateApiRouter.get(
    '/internal/api/admin/personal-access-token-reissues/:id',
    AuthenticationController.requirePrivateApiAuth(),
    TokenReissueController.get
  )

  // Token introspection for other services (private API)
  privateApiRouter.post(
    '/internal/api/tokens/introspect',
    AuthenticationController.requirePrivateApiAuth(),
    TokenController.introspect
  )
  privateApiRouter.post(
    '/internal/expire-deleted-users-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUsersAfterDuration
  )
  privateApiRouter.post(
    '/internal/project/:projectId/expire-deleted-project',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProject
  )
  privateApiRouter.post(
    '/internal/users/:userId/expire',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUser
  )

  privateApiRouter.get(
    '/user/:userId/tag',
    AuthenticationController.requirePrivateApiAuth(),
    TagsController.apiGetAllTags
  )
  webRouter.get(
    '/tag',
    AuthenticationController.requireLogin(),
    TagsController.getAllTags
  )
  webRouter.post(
    '/tag',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.createTag),
    TagsController.createTag
  )
  webRouter.post(
    '/tag/:tagId/rename',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.renameTag),
    TagsController.renameTag
  )
  webRouter.post(
    '/tag/:tagId/edit',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.renameTag),
    TagsController.editTag
  )
  webRouter.delete(
    '/tag/:tagId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.deleteTag),
    TagsController.deleteTag
  )
  webRouter.post(
    '/tag/:tagId/project/:projectId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.addProjectToTag),
    TagsController.addProjectToTag
  )
  webRouter.post(
    '/tag/:tagId/projects',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.addProjectsToTag),
    TagsController.addProjectsToTag
  )
  webRouter.delete(
    '/tag/:tagId/project/:projectId',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.removeProjectFromTag),
    TagsController.removeProjectFromTag
  )
  webRouter.post(
    '/tag/:tagId/projects/remove',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.removeProjectsFromTag),
    TagsController.removeProjectsFromTag
  )

  webRouter.get(
    '/notifications',
    AuthenticationController.requireLogin(),
    NotificationsController.getAllUnreadNotifications
  )
  webRouter.delete(
    '/notifications/:notificationId',
    AuthenticationController.requireLogin(),
    NotificationsController.markNotificationAsRead
  )

  webRouter.get(
    '/user/notification/:notificationId',
    AuthenticationController.requireLogin(),
    NotificationsController.getNotification
  )

  // Deprecated in favour of /internal/project/:project_id but still used by versioning
  privateApiRouter.get(
    '/project/:project_id/details',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )

  // New 'stable' /internal API end points
  privateApiRouter.get(
    '/internal/project/:project_id',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )

  // Service-facing route for internal lookups (Basic auth protected)
  privateApiRouter.get(
    '/internal/api/service/users/:userId/ssh-keys',
    AuthenticationController.requirePrivateApiAuth(),
    UserSSHKeysController.listForService
  )
  privateApiRouter.get(
    '/internal/project/:Project_id/zip',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectDownloadsController.downloadProject
  )
  privateApiRouter.get(
    '/internal/project/:project_id/compile/pdf',
    AuthenticationController.requirePrivateApiAuth(),
    CompileController.compileAndDownloadPdf
  )

  privateApiRouter.post(
    '/internal/deactivateOldProjects',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateOldProjects
  )
  privateApiRouter.post(
    '/internal/project/:project_id/deactivate',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateProject
  )

  privateApiRouter.get(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.getDocument
  )
  privateApiRouter.post(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.setDocument
  )

  privateApiRouter.post(
    '/user/:user_id/project/new',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.createProject
  )
  privateApiRouter.post(
    '/tpds/folder-update',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateFolder
  )
  privateApiRouter.post(
    '/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )
  privateApiRouter.post(
    '/project/:project_id/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/project/:project_id/user/:user_id/update/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )

  privateApiRouter.post(
    '/project/:project_id/contents/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateProjectContents
  )
  privateApiRouter.delete(
    '/project/:project_id/contents/*',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteProjectContents
  )

  webRouter.post(
    '/spelling/learn',
    AuthenticationController.requireLogin(),
    SpellingController.learn
  )

  webRouter.post(
    '/spelling/unlearn',
    AuthenticationController.requireLogin(),
    SpellingController.unlearn
  )

  if (Features.hasFeature('chat')) {
    webRouter.get(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.getMessages
    )
    webRouter.post(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      RateLimiterMiddleware.rateLimit(rateLimiters.sendChatMessage),
      ChatController.sendMessage
    )
    webRouter.delete(
      '/project/:project_id/messages/:message_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.deleteMessage
    )
    webRouter.post(
      '/project/:project_id/messages/:message_id/edit',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.editMessage
    )
  }

  webRouter.post(
    '/project/:Project_id/references/indexAll',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit(rateLimiters.indexAllProjectReferences),
    ReferencesController.indexAll
  )

  // disable beta program while v2 is in beta
  webRouter.get(
    '/beta/participate',
    AuthenticationController.requireLogin(),
    BetaProgramController.optInPage
  )
  webRouter.post(
    '/beta/opt-in',
    AuthenticationController.requireLogin(),
    BetaProgramController.optIn
  )
  webRouter.post(
    '/beta/opt-out',
    AuthenticationController.requireLogin(),
    BetaProgramController.optOut
  )

  webRouter.get('/chrome', function (req, res, next) {
    // Match v1 behaviour - this is used for a Chrome web app
    if (SessionManager.isUserLoggedIn(req.session)) {
      res.redirect('/project')
    } else {
      res.redirect('/register')
    }
  })

  webRouter.get(
    '/admin',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.index
  )

  if (!Features.hasFeature('saas')) {
    webRouter.post(
      '/admin/openEditor',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.openEditor
    )
    webRouter.post(
      '/admin/closeEditor',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.closeEditor
    )
    webRouter.post(
      '/admin/disconnectAllUsers',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      AdminController.disconnectAllUsers
    )
  }
  webRouter.post(
    '/admin/flushProjectToTpds',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.flushProjectToTpds
  )
  webRouter.post(
    '/admin/pollDropboxForUser',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.pollDropboxForUser
  )
  webRouter.post(
    '/admin/messages',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.createMessage
  )
  webRouter.post(
    '/admin/messages/clear',
    AuthorizationMiddleware.ensureUserIsSiteAdmin,
    AdminController.clearMessages
  )

  privateApiRouter.get('/perfTest', (req, res) => {
    plainTextResponse(res, 'hello')
  })

  publicApiRouter.get('/status', (req, res) => {
    if (Settings.shuttingDown) {
      res.sendStatus(503) // Service unavailable
    } else if (!Settings.siteIsOpen) {
      plainTextResponse(res, 'web site is closed (web)')
    } else if (!Settings.editorIsOpen) {
      plainTextResponse(res, 'web editor is closed (web)')
    } else {
      plainTextResponse(res, 'web is alive (web)')
    }
  })
  privateApiRouter.get('/status', (req, res) => {
    plainTextResponse(res, 'web is alive (api)')
  })

  // used by kubernetes health-check and acceptance tests
  webRouter.get('/dev/csrf', (req, res) => {
    plainTextResponse(res, res.locals.csrfToken)
  })

  publicApiRouter.get(
    '/health_check',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )
  privateApiRouter.get(
    '/health_check',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  publicApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  privateApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  publicApiRouter.get(
    '/health_check/full',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )
  privateApiRouter.get(
    '/health_check/full',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.check
  )

  publicApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)
  privateApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)

  publicApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)
  privateApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)

  webRouter.get(
    '/status/compiler/:Project_id',
    RateLimiterMiddleware.rateLimit(rateLimiters.statusCompiler),
    AuthorizationMiddleware.ensureUserCanReadProject,
    function (req, res) {
      const projectId = req.params.Project_id
      // use a valid user id for testing
      const testUserId = '123456789012345678901234'
      const sendRes = _.once(function (statusCode, message, clsiServerId) {
        res.status(statusCode)
        plainTextResponse(res, message)
        // Force every compile to a new server and do not leave cruft behind.
        CompileManager.promises
          .deleteAuxFiles(projectId, testUserId, clsiServerId)
          .catch(() => {})
      })
      let handler = setTimeout(function () {
        CompileManager.promises
          .stopCompile(projectId, testUserId)
          .catch(() => {})
        sendRes(500, 'Compiler timed out')
        handler = null
      }, 10000)
      CompileManager.compile(
        projectId,
        testUserId,
        { metricsPath: 'health-check' },
        function (error, status, _outputFiles, clsiServerId) {
          if (handler) {
            clearTimeout(handler)
          }
          if (error) {
            sendRes(
              500,
              `Compiler returned error ${error.message}`,
              clsiServerId
            )
          } else if (status === 'success') {
            sendRes(
              200,
              'Compiler returned in less than 10 seconds',
              clsiServerId
            )
          } else {
            sendRes(500, `Compiler returned failure ${status}`, clsiServerId)
          }
        }
      )
    }
  )

  webRouter.post('/error/client', function (req, res, next) {
    logger.warn(
      { err: req.body.error, meta: req.body.meta },
      'client side error'
    )
    metrics.inc('client-side-error')
    res.sendStatus(204)
  })

  if (Features.hasFeature('link-sharing')) {
    webRouter.get(
      `/read/:token(${TokenAccessController.READ_ONLY_TOKEN_PATTERN})`,
      RateLimiterMiddleware.rateLimit(rateLimiters.readOnlyToken),
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'link-sharing'
      ),
      TokenAccessController.tokenAccessPage,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.get(
      `/:token(${TokenAccessController.READ_AND_WRITE_TOKEN_PATTERN})`,
      RateLimiterMiddleware.rateLimit(rateLimiters.readAndWriteToken),
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'link-sharing'
      ),
      TokenAccessController.tokenAccessPage,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.post(
      `/:token(${TokenAccessController.READ_AND_WRITE_TOKEN_PATTERN})/grant`,
      RateLimiterMiddleware.rateLimit(rateLimiters.grantTokenAccessReadWrite),
      TokenAccessController.grantTokenAccessReadAndWrite
    )

    webRouter.post(
      `/read/:token(${TokenAccessController.READ_ONLY_TOKEN_PATTERN})/grant`,
      RateLimiterMiddleware.rateLimit(rateLimiters.grantTokenAccessReadOnly),
      TokenAccessController.grantTokenAccessReadOnly
    )
  }

  webRouter.get('/unsupported-browser', renderUnsupportedBrowserPage)

  webRouter.get('*', ErrorController.notFound)
}

export default { initialize, rateLimiters }
