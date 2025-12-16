import UserHelper from '../../acceptance/src/helpers/UserHelper.mjs'

describe('Manual repro SSH key', function () {
  this.timeout(60 * 1000)

  it('posts ssh key and logs response', async function () {
    // Create a user via the same server-side helper used in other tests
    const user = await UserHelper.createUser()
    // Debug: show identity & session
    // eslint-disable-next-line no-console
    console.debug('[ManualReproSSH] created user', { id: user.id })

    // Fetch the DB user doc and print hashedPassword metadata to assist triage
    try {
      const { User } = await import('../../../../app/src/models/User.js')
      const dbUser = await User.findById(user.id).lean().exec()
      // eslint-disable-next-line no-console
      console.debug('[ManualReproSSH] dbUser hashedPassword info', { id: user.id, hasHashedPassword: !!dbUser?.hashedPassword, hashedPasswordLength: dbUser?.hashedPassword?.length, hashedPasswordPrefix: typeof dbUser?.hashedPassword === 'string' ? dbUser.hashedPassword.slice(0,8) : undefined })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ManualReproSSH] cannot fetch db user', e && e.stack ? e.stack : e)
    }

    try {
      // ensure we have CSRF token set for this client
      // eslint-disable-next-line no-console
      console.debug('[ManualReproSSH] getCsrfToken before create')
      await user.getCsrfToken()
      const resCreate = await user.doRequest('post', {
        url: `/internal/api/users/${user.id}/ssh-keys`,
        json: { key_name: 'manual-test', public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDexamplekeyDATA' },
      })
      // eslint-disable-next-line no-console
      console.debug('[ManualReproSSH] create response', { status: resCreate.response.statusCode, body: resCreate.body })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ManualReproSSH] request threw', err && err.stack ? err.stack : err)
      throw err
    }
  })

  it('creates user with known password then logs in and posts ssh key', async function () {
    const knownEmail = `manual.known.${Date.now()}@example.com`
    const knownPassword = `known-pass-${Date.now()}`

    const AuthenticationManager = (await import('/overleaf/services/web/app/src/Features/Authentication/AuthenticationManager.mjs')).default
    const UserCreator = (await import('/overleaf/services/web/app/src/Features/User/UserCreator.mjs')).default

    const hashed = await AuthenticationManager.promises.hashPassword(knownPassword)
    const created = await UserCreator.promises.createNewUser({ email: knownEmail, first_name: 'manual', hashedPassword: hashed }, { confirmedAt: new Date() })
    // eslint-disable-next-line no-console
    console.debug('[ManualReproSSH] created user with known password', { id: String(created._id), email: knownEmail })

    // sanity check: verify direct bcrypt compare
    const checkRes = await AuthenticationManager.promises._checkUserPassword({ email: knownEmail }, knownPassword)
    // eslint-disable-next-line no-console
    console.debug('[ManualReproSSH] direct check result', { userId: checkRes.user && checkRes.user._id ? String(checkRes.user._id) : null, match: checkRes.match })

    // create a User test client and attempt login + ssh post
    const UserClass = (await import('../../acceptance/src/helpers/User.mjs')).default
    const userClient = new UserClass({ email: created.email })
    userClient.setExtraAttributes(created)
    userClient.password = knownPassword

    // Ensure doRequest exists on the instance (some environments attach it to `promises` only)
    if (typeof userClient.doRequest !== 'function') {
      if (userClient.promises && typeof userClient.promises.doRequest === 'function') {
        userClient.doRequest = (...args) => userClient.promises.doRequest(...args)
      } else {
        userClient.doRequest = async function (method, params) {
          return new Promise((resolve, reject) => {
            this.request[method.toLowerCase()](params, (err, response, body) => {
              if (err) return reject(err)
              resolve({ response, body })
            })
          })
        }
      }
    }

    // perform login explicitly and report errors
    await new Promise((resolve, reject) => {
      userClient.loginWithEmailPassword(userClient.email, userClient.password, (err, response, body) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error('[ManualReproSSH] explicit login failed', err && err.message ? err.message : err)
          return reject(err)
        }
        // eslint-disable-next-line no-console
        console.debug('[ManualReproSSH] explicit login success', { status: response.statusCode, body })
        resolve()
      })
    })

    // ensure we have CSRF token set for this logged-in client
    await userClient.getCsrfToken()

    // now do create ssh key
    const resCreate = await userClient.doRequest('post', { url: `/internal/api/users/${userClient.id}/ssh-keys`, json: { key_name: 'manual-known', public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDexamplekeyDATA' } })
    // eslint-disable-next-line no-console
    console.debug('[ManualReproSSH] create response for known user', { status: resCreate.response.statusCode, body: resCreate.body })
  })
})
