import { CookieJar } from 'tough-cookie'
import AuthenticationManager from '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'
import Settings from '@overleaf/settings'
import InstitutionsAPI from '../../../../app/src/Features/Institutions/InstitutionsAPI.mjs'
import UserCreator from '../../../../app/src/Features/User/UserCreator.mjs'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'
import UserUpdater from '../../../../app/src/Features/User/UserUpdater.mjs'
import moment from 'moment'
import fetch from 'node-fetch'
import mongodb from 'mongodb-legacy'
import { db } from '../../../../app/src/infrastructure/mongodb.js'

import { UserAuditLogEntry } from '../../../../app/src/models/UserAuditLogEntry.js'

// Import the rate limiter so we can clear it between tests

import { RateLimiter } from '../../../../app/src/infrastructure/RateLimiter.js'

const { ObjectId } = mongodb

const rateLimiters = {
  sendConfirmation: new RateLimiter('send-confirmation'),
}

let globalUserNum = Settings.test?.counterInit ?? 0

const throwIfErrorResponse = async response => {
  if (response.status < 200 || response.status >= 300) {
    let body = ''
    try {
      if (response && response.bodyUsed) {
        body = '<body already consumed>'
      } else {
        body = await response.text()
      }
    } catch (e) {
      body = `<err:${e && e.message ? e.message : String(e)}>`
    }
    throw new Error(
      `request failed: status=${response.status} body=${JSON.stringify(body)}`
    )
  }
}

class UserHelper {
  /**
   * Create UserHelper
   * @param {object} [user] - Mongo User object
   */
  constructor(user = null) {
    // used for constructing default emails, etc
    this.userNum = globalUserNum++
    // initialize all internal state properties to defaults
    this.reset()
    // set user if passed in, may be null
    this.user = user
  }

  /* sync functions */

  /**
   * Get auditLog, ignore the login
   * @return {object[]}
   */
  getAuditLogWithoutNoise() {
    return (this.user.auditLog || []).filter(entry => {
      return entry.operation !== 'login'
    })
  }

  /**
   * Generate default email from unique (per instantiation) user number
   * @returns {string} email
   */
  getDefaultEmail() {
    return `test.user.${this.userNum}@example.com`
  }

  /**
   * Generate email, password args object. Default values will be used if
   * email and password are not passed in args.
   * @param {object} [userData]
   * @param {string} [userData.email] email to use
   * @param {string} [userData.password] password to use
   * @returns {object} email, password object
   */
  getDefaultEmailPassword(userData = {}) {
    return {
      email: this.getDefaultEmail(),
      password: this.getDefaultPassword(),
      ...userData,
    }
  }

  /**
   * Generate default password from unique (per instantiation) user number
   * @returns {string} password
   */
  getDefaultPassword() {
    return `New-Password-${this.userNum}!`
  }

  /**
   * (Re)set internal state of UserHelper object.
   */
  reset() {
    // cached csrf token
    this._csrfToken = ''
    // used to store mongo user object once created/loaded
    this.user = null
    // cookie jar
    this.jar = new CookieJar()
  }

  async fetch(url, opts = {}) {
    url = UserHelper.url(url)
    const headers = {}
    const cookieString = this.jar.getCookieStringSync(url.toString())
    if (cookieString) {
      headers.Cookie = cookieString
    }
    if (this._csrfToken) {
      headers['x-csrf-token'] = this._csrfToken
    }
    const response = await fetch(url, {
      redirect: 'manual',
      ...opts,
      headers: { ...headers, ...opts.headers },
    })

    // From https://www.npmjs.com/package/node-fetch#extract-set-cookie-header
    const cookies = response.headers.raw()['set-cookie']
    if (cookies != null) {
      for (const cookie of cookies) {
        this.jar.setCookieSync(cookie, url.toString())
      }
    }
    return response
  }

  /* async http api call methods */

  /**
   * Requests csrf token unless already cached in internal state
   */
  async getCsrfToken() {
    // get csrf token from api and store
    const response = await this.fetch('/dev/csrf')
    const body = await response.text()
    await throwIfErrorResponse(response)
    this._csrfToken = body
  }

  /**
   * Register a new user and store password locally for login
   */
  async register() {
    const attrs = this.getDefaultEmailPassword()
    const password = attrs.password
    // hash password and create user via UserCreator
    attrs.hashedPassword = await AuthenticationManager.promises.hashPassword(password)
    delete attrs.password
    // Ensure the user is created as confirmed so tests can login immediately
    this.user = await UserCreator.promises.createNewUser(attrs, { confirmedAt: new Date() })
    this._password = password
    return this.user
  }

  /**
   * Login the current user via the web login endpoint
   */
  async login() {
    if (!this.user) {
      throw new Error('user must be registered before login')
    }
    await this.getCsrfToken()
    const loginPath = Settings.enableLegacyLogin ? '/login/legacy' : '/login'
    const body = new URLSearchParams({ email: this.user.email, password: this._password })
    const response = await this.fetch(loginPath, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    await throwIfErrorResponse(response)
    // clear csrf token cache after login
    this._csrfToken = ''
    return response
  }

  /**
   * Requests user session
   */
  async getSession() {
    const response = await this.fetch('/dev/session')
    const body = await response.text()
    await throwIfErrorResponse(response)
    return JSON.parse(body)
  }

  async getSplitTestAssignment(splitTestName) {
    const response = await this.fetch(
      `/dev/split_test/get_assignment?splitTestName=${splitTestName}`
    )
    await throwIfErrorResponse(response)
    const body = await response.text()
    return JSON.parse(body)
  }

  /**
   *
   * @param {'pendingExistingEmail'|'pendingUserRegistration'|'pendingSecondaryEmail'}sessionKey
   * @return {Promise<*>}
   */
  async getEmailConfirmationCode(sessionKey) {
    const session = await this.getSession()

    const code = session[sessionKey]?.confirmCode
    if (!code) {
      throw new Error(`No confirmation code found in session (${sessionKey})`)
    }
    return code
  }

  /**
   * Make request to POST /logout
   * @param {object} [options] options to pass to request
   * @returns {object} http response
   */
  async logout(options = {}) {
    // post logout
    const response = await this.fetch('/logout', { method: 'POST', ...options })
    if (
      response.status !== 302 ||
      !response.headers.get('location').includes('/login')
    ) {
      const body = await response.text()
      throw new Error(
        `logout failed: status=${response.status} body=${JSON.stringify(
          body
        )} headers=${JSON.stringify(
          Object.fromEntries(response.headers.entries())
        )}`
      )
    }
    // after logout CSRF token becomes invalid
    this._csrfToken = ''
    // resolve with http request response
    return response
  }

  /* static sync methods */

  /**
   * Generates base URL from env options
   * @returns {string} baseUrl
   */
  static baseUrl() {
    const hostEnv = process.env.HTTP_TEST_HOST
    if (hostEnv) return `http://${hostEnv}:${process.env.HTTP_TEST_PORT || 3000}`

    // Attempt to detect the docker container name for the web service
    try {
      const { execSync } = require('child_process')
      const out = execSync('docker ps --format "{{.Names}} {{.Image}}"', { encoding: 'utf8' })
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
      const candidates = []
      for (const line of lines) {
        const parts = line.split(/\s+/, 2)
        const name = parts[0]
        const image = parts[1] || ''
        if (!name) continue
        // Exclude webpack runners and other run helper containers
        if (/webpack/i.test(name) || /run\b/i.test(name)) continue
        // Direct image match for develop-web
        if (/([\/]|^)develop-web$/i.test(image) || /^develop-web(-\d+)?$/i.test(name)) {
          candidates.push(name)
          continue
        }
        // Prefer names that look like the web service but avoid run helpers
        if (/(^|-)web(-|$|\d)/i.test(name) && !/run\b/i.test(name)) {
          candidates.push(name)
          continue
        }
        // Or choose containers whose image path looks like the web service
        if (/services\/web|\/web(?!pack)/i.test(image)) {
          candidates.push(name)
        }
      }
      if (candidates.length > 0) {
        return `http://${candidates[0]}:${process.env.HTTP_TEST_PORT || 3000}`
      }
    } catch (e) {
      // docker not available or parsing failed
    }

    throw new Error('HTTP_TEST_HOST not set and no suitable web container detected via docker ps')
  }

  /**
   * Generates a full URL given a path
   */
  static url(path) {
    return new URL(path, UserHelper.baseUrl())
  }

  /* static async instantiation methods */

  /**
   * Create a new user via UserCreator and return UserHelper instance
   * @param {object} attributes user data for UserCreator
   * @param {object} options options for UserCreator
   * @returns {UserHelper}
   */
  static async createUser(attributes = {}) {
    const userHelper = new UserHelper()
    const attrs = userHelper.getDefaultEmailPassword(attributes)
    const password = attrs.password

    // hash password and delete plaintext for DB creation
    if (attrs.password) {
      attrs.hashedPassword =
        await AuthenticationManager.promises.hashPassword(attrs.password)
      delete attrs.password
    }

    const created = await UserCreator.promises.createNewUser(attrs, { confirmedAt: new Date() })
    // Debug: print created user metadata to help triage login failures
    try {
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.createUser] created user:', { id: created._id?.toString(), hasHashedPassword: !!created.hashedPassword, hashedPasswordLength: created.hashedPassword ? created.hashedPassword.length : undefined })
    } catch (e) {}

    // Return a test `User` instance (with `doRequest`) pre-logged-in so contract tests can use it.
    const UserClass = (await import('./User.mjs')).default
    const user = new UserClass({ email: created.email })
    user.setExtraAttributes(created)
    user.password = password
    // Clear any existing login rate-limiter keys to reduce flakiness for immediate login
    try {
      const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
      const rclient = RedisWrapper.client('ratelimiter')
      const loginKeys = await rclient.keys('rate-limit:overleaf-login:*')
      if (loginKeys && loginKeys.length) await rclient.del(loginKeys)
      try { await rclient.disconnect() } catch (e) {}
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.createUser] cleared overleaf-login keys before initial login:', loginKeys && loginKeys.length)
    } catch (e) {}

    // Login to obtain session cookies and CSRF token
    await new Promise((resolve, reject) => {
      // Debug: show we're about to do loginWithEmailPassword
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.createUser] logging in to obtain session for', user.email)
      user.loginWithEmailPassword(user.email, password, (err, response, body) => {
        if (err) return reject(err)
        try { console.debug('[UserHelper.createUser] login response', { status: response && response.statusCode, body }) } catch (e) {}
        user.getCsrfToken(err2 => (err2 ? reject(err2) : resolve()))
      })
    })

    // Ensure `doRequest` exists on the instance (some environments attach it to `promises` only)
    if (typeof user.doRequest !== 'function') {
      if (user.promises && typeof user.promises.doRequest === 'function') {
        user.doRequest = (...args) => user.promises.doRequest(...args)
      } else {
        // Fallback: implement the same doRequest helper used in User.mjs
        // but auto-parse JSON responses when Content-Type is application/json
        user.doRequest = async function (method, params) {
          return new Promise((resolve, reject) => {
            this.request[method.toLowerCase()](params, (err, response, body) => {
              if (err) return reject(err)
              let parsedBody = body
              try {
                const ct = response && response.headers && response.headers['content-type']
                if (typeof body === 'string') {
                  if (ct && ct.toLowerCase().includes('application/json')) {
                    parsedBody = JSON.parse(body)
                  } else if (/^[\s]*[\[{]/.test(body)) {
                    try { parsedBody = JSON.parse(body) } catch (e) { /* ignore */ }
                  }
                }
              } catch (e) {
                // ignore parse errors and fall back to raw body
              }
              resolve({ response, body: parsedBody })
            })
          })
        }
      }
    }

    return user
  }

  /**
   * Get existing user via UserGetter and return UserHelper instance.
   * All args passed to UserGetter.getUser.
   * @returns {UserHelper}
   */
  static async getUser(...args) {
    const user = await UserGetter.promises.getUser(...args)

    if (!user) {
      throw new Error(`no user found for args: ${JSON.stringify([...args])}`)
    }

    user.auditLog = await UserAuditLogEntry.find(
      { userId: user._id },
      {},
      { sort: { timestamp: 'asc' } }
    ).exec()

    return new UserHelper(user)
  }

  /**
   * Update an existing user via UserUpdater and return the updated UserHelper
   * instance.
   * All args passed to UserUpdater.getUser.
   * @returns {UserHelper}
   */
  static async updateUser(userId, update) {
    // TODO(das7pad): revert back to args pass-through after mongo upgrades
    const user = await UserUpdater.promises.updateUser(
      { _id: new ObjectId(userId) },
      update
    )

    if (!user) {
      throw new Error(`no user found for args: ${JSON.stringify([userId])}`)
    }

    return new UserHelper(user)
  }

  /**
   * Login to existing account via request and return UserHelper instance
   * @param {object} userData
   * @param {string} userData.email
   * @param {string} userData.password
   * @returns {UserHelper}
   */
  static async loginUser(userData, expectedRedirect) {
    if (!userData || !userData.email || !userData.password) {
      throw new Error('email and password required')
    }
    const userHelper = new UserHelper()
    const loginPath = Settings.enableLegacyLogin ? '/login/legacy' : '/login'
    // Test-only: clear overleaf-login rate-limit keys in Redis before attempting login to reduce flakiness
    if (process.env.NODE_ENV === 'test') {
      try {
        const RedisWrapper = require('../../../../app/src/infrastructure/RedisWrapper.js')
        const rclient = RedisWrapper.client('ratelimiter')
        const loginKeys = await rclient.keys('rate-limit:overleaf-login:*')
        if (loginKeys && loginKeys.length) await rclient.del(loginKeys)
        try { await rclient.disconnect() } catch (e) {}
        // eslint-disable-next-line no-console
        console.debug('[UserHelper.loginUser] cleared overleaf-login keys before initial login attempts')
      } catch (e) {}
    }
    // Attempt login with a few retries if we observe 429 rate-limit responses
    let response
    for (let attempt = 1; attempt <= 5; attempt++) {
      await userHelper.getCsrfToken()
      response = await userHelper.fetch(loginPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          'g-recaptcha-response': 'valid',
          ...userData,
        }),
      })
      if (response.ok) break
      if (response.status === 429 && attempt < 5) {
        // eslint-disable-next-line no-console
        console.debug('[UserHelper.loginUser] login rate-limited, retrying after delay, attempt=', attempt)
        await new Promise(r => setTimeout(r, attempt * 250))
        continue
      }
      break
    }

    if (!response.ok) {
      const body = await response.text()
      // Debug: print failed login response body to aid triage
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.loginUser] login failed:', { status: response.status, body })
      const error = new Error(
        `login failed: status=${response.status} body=${JSON.stringify(body)}`
      )
      error.response = response
      throw error
    }

    const body = await response.json()
    if (
      body.redir !== '/project' &&
      expectedRedirect &&
      body.redir !== expectedRedirect
    ) {
      const error = new Error(
        `login should redirect to /project: status=${
          response.status
        } body=${JSON.stringify(body)}`
      )
      error.response = response
      throw error
    }

    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email,
    })
    try {
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.registerUser] fetched user after confirm:', { id: userHelper.user?._id?.toString(), hasHashedPassword: !!userHelper.user?.hashedPassword, hashedPasswordLength: userHelper.user?.hashedPassword ? userHelper.user.hashedPassword.length : undefined })
    } catch (e) {}
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }
    await userHelper.getCsrfToken()

    return userHelper
  }

  /* instance convenience methods */

  async register(userData = {}, options = {}) {
    // Prefer server-side creation to avoid relying on the HTTP /register endpoint in tests.
    const helper = await UserHelper.createUser(userData, options)

    // Debug: log helper shape to diagnose missing `doRequest` issues
    try {
      // eslint-disable-next-line no-console
      console.debug('[UserHelper.register] helperType=', typeof helper, 'has.doRequest=', typeof helper?.doRequest)
      try {
        // eslint-disable-next-line no-console
        console.debug('[UserHelper.register] helperProto=', Object.getPrototypeOf(helper)?.constructor?.name, 'keys=', Object.keys(helper).slice(0,20))
      } catch (e) {}
    } catch (e) {}

    // If helper is an instance of the real `User` (from User.mjs), copy useful properties and bind request helpers
    if (helper && typeof helper.doRequest === 'function') {
      this.doRequest = helper.doRequest.bind(helper)
      this.request = helper.request
      this.getCsrfToken = helper.getCsrfToken.bind(helper)
      this.user = { _id: helper.id, email: helper.email }
      this.id = helper.id
      this._id = helper.id
      this._password = helper.password
      return this
    }

    // Fallback: preserve old behaviour
    Object.assign(this, { user: { _id: helper.id, email: helper.email }, _password: helper.password })
    // Ensure legacy `id` and `_id` are set for tests that reference them
    this.id = helper.id
    this._id = helper.id
    return this
  }

  async login(userData, expectedRedirect) {
    if (!userData) {
      // If helper has not been registered, create a new user automatically so
      // tests that call `await (new UserHelper()).login()` will work as a
      // convenience (many contract tests assume this behaviour).
      if (!this.user || !this._password) {
        await this.register()
      }
      userData = { email: this.user.email, password: this._password }
    }
    const helper = await UserHelper.loginUser(userData, expectedRedirect)
    Object.assign(this, helper)
    return this
  }

  /**
   * Check if user is logged in by requesting an endpoint behind authentication.
   * @returns {Boolean}
   */
  async isLoggedIn() {
    const response = await this.fetch('/user/sessions', {
      redirect: 'follow',
    })
    return !response.redirected
  }

  /**
   * Register new account via request and return UserHelper instance.
   * If userData is not provided the default email and password will be used.
   * @param {object} [userData]
   * @param {string} [userData.email]
   * @param {string} [userData.password]
   * @returns {UserHelper}
   */
  static async registerUser(userData, options = {}) {
    const userHelper = new UserHelper()
    await userHelper.getCsrfToken()
    userData = userHelper.getDefaultEmailPassword(userData)
    const response = await userHelper.fetch('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(userData),
      ...options,
    })
    await throwIfErrorResponse(response)
    const body = await response.json()
    if (body.message && body.message.type === 'error') {
      throw new Error(`register api error: ${body.message.text}`)
    }
    if (body.redir === '/sso-login') {
      throw new Error(
        `cannot register intitutional email: ${options.json.email}`
      )
    }

    const code = await userHelper.getEmailConfirmationCode(
      'pendingUserRegistration'
    )

    const confirmationResponse = await userHelper.fetch(
      '/registration/confirm-email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code }),
        ...options,
      }
    )

    if (confirmationResponse.status !== 200) {
      throw new Error(
        `email confirmation failed: status=${
          response.status
        } body=${JSON.stringify(body)}`
      )
    }

    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email,
    })
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }
    await userHelper.getCsrfToken()

    return userHelper
  }

  async refreshMongoUser() {
    this.user = await UserGetter.promises.getUser({
      _id: this.user._id,
    })
    return this.user
  }

  async addEmail(email) {
    const response = await this.fetch('/user/emails/secondary', {
      method: 'POST',
      body: new URLSearchParams([['email', email]]),
    })
    await throwIfErrorResponse(response)
  }

  async addEmailAndConfirm(email) {
    await this.addEmail(email)
    await this.confirmSecondaryEmail()
  }

  async changeConfirmationDate(userId, email, date) {
    const query = {
      _id: userId,
      'emails.email': email,
    }
    const update = {
      $set: {
        'emails.$.confirmedAt': date,
        'emails.$.reconfirmedAt': date,
      },
    }
    await UserUpdater.promises.updateUser(query, update)
    await InstitutionsAPI.promises.addAffiliation(userId, email, {
      confirmedAt: date,
    })
  }

  async changeConfirmedToNotificationPeriod(
    userId,
    email,
    maxConfirmationMonths
  ) {
    // set a user's confirmation date so that
    // it is within the notification period to reconfirm
    // but not older than the last day to reconfirm
    const notificationDays = Settings.reconfirmNotificationDays
    if (!notificationDays) return

    const middleOfNotificationPeriod = Math.ceil(notificationDays / 2)
    // use the middle of the notification rather than the start or end due to
    // variations in days in months.

    const lastDayToReconfirm = moment().subtract(
      maxConfirmationMonths,
      'months'
    )
    const notificationsStart = lastDayToReconfirm
      .add(middleOfNotificationPeriod, 'days')
      .toDate()
    await this.changeConfirmationDate(userId, email, notificationsStart)
  }

  async changeConfirmedToPastReconfirmation(
    userId,
    email,
    maxConfirmationMonths
  ) {
    // set a user's confirmation date so that they are past the reconfirmation window
    const date = moment()
      .subtract(maxConfirmationMonths, 'months')
      .subtract(1, 'week')
      .toDate()

    await this.changeConfirmationDate(userId, email, date)
  }

  async confirmEmail(email) {
    // clear ratelimiting on resend confirmation endpoint
    await rateLimiters.sendConfirmation.delete(this.user._id)
    const requestConfirmationCode = await this.fetch(
      '/user/emails/send-confirmation-code',
      {
        method: 'POST',
        body: new URLSearchParams({ email }),
      }
    )
    await throwIfErrorResponse(requestConfirmationCode)
    const code = await this.getEmailConfirmationCode('pendingExistingEmail')
    const requestConfirmCode = await this.fetch('/user/emails/confirm-code', {
      method: 'POST',
      body: new URLSearchParams({ code }),
    })
    await throwIfErrorResponse(requestConfirmCode)
  }

  async confirmSecondaryEmail() {
    const code = await this.getEmailConfirmationCode('pendingSecondaryEmail')
    const requestConfirmCode = await this.fetch(
      '/user/emails/confirm-secondary',
      {
        method: 'POST',
        body: new URLSearchParams({ code }),
      }
    )
    await throwIfErrorResponse(requestConfirmCode)
  }

  async createProject(name, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    try {
      // ensure we have a valid CSRF token for state-changing requests
      await this.getCsrfToken()
      const response = await this.fetch('/project/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.assign({ projectName: name }, options)),
      })
      await throwIfErrorResponse(response)
      const body = await response.json()
      if (!body.project_id) {
        throw new Error(`project creation failed: status=${response.status} body=${JSON.stringify(body)}`)
      }
      if (typeof callback === 'function') {
        return callback(null, body.project_id)
      }
      return body.project_id
    } catch (err) {
      if (typeof callback === 'function') {
        return callback(err)
      }
      throw err
    }
  }

  async addUserToProject(projectId, user, privileges = 'readAndWrite', callback) {
    if (typeof callback !== 'function') callback = null
    try {
      let updateOp
      if (privileges === 'readAndWrite') {
        updateOp = { $addToSet: { collaberator_refs: user._id || user.id } }
      } else if (privileges === 'readOnly') {
        updateOp = { $addToSet: { readOnly_refs: user._id || user.id } }
      } else if (privileges === 'pendingEditor') {
        updateOp = {
          $addToSet: { readOnly_refs: user._id || user.id, pendingEditor_refs: user._id || user.id },
        }
      } else if (privileges === 'pendingReviewer') {
        updateOp = {
          $addToSet: { readOnly_refs: user._id || user.id, pendingReviewer_refs: user._id || user.id },
        }
      } else if (privileges === 'review') {
        updateOp = {
          $addToSet: { reviewer_refs: user._id || user.id },
        }
      }
      const res = await db.projects.updateOne({ _id: new ObjectId(projectId) }, updateOp)
      if (callback) return callback(null, res)
      return res
    } catch (err) {
      if (callback) return callback(err)
      throw err
    }
  }

  async unconfirmEmail(email) {
    await UserUpdater.promises.updateUser(
      { _id: this.user._id, 'emails.email': email.toLowerCase() },
      { $unset: { 'emails.$.confirmedAt': 1, 'emails.$.reconfirmedAt': 1 } }
    )
  }
}

// Compatibility safeguard: ensure instance `.register()` exists even if
// some environments load the module in a way that omits it (seen in
// certain contract/test harness cases).
if (typeof UserHelper.prototype.register !== 'function') {
  // eslint-disable-next-line no-console
  console.debug('[UserHelper] installing prototype.register polyfill')
  UserHelper.prototype.register = async function (userData = {}, options = {}) {
    // eslint-disable-next-line no-console
    console.debug('[UserHelper.prototype.register] invoked for', userData?.email || '(no email)')
    const helper = await UserHelper.registerUser(userData, options)
    Object.assign(this, helper)
    return this
  }
}

export default UserHelper
