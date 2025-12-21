const { merge } = require('@overleaf/settings/merge')
const baseApp = require('../../../config/settings.overrides.saas')
const baseTest = require('./settings.test.defaults')

const httpAuthUser = 'overleaf'
const httpAuthPass = 'password'
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

const overleafHost = (function () {
  if (process.env.V2_URL) return process.env.V2_URL
  if (process.env.HTTP_TEST_HOST) return `http://${process.env.HTTP_TEST_HOST}:${process.env.HTTP_TEST_PORT || 3000}`
  try {
    const { execSync } = require('child_process')
    const out = execSync('docker ps --format "{{.Names}} {{.Image}}"', { encoding: 'utf8' })
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/\s+/, 2)
      const name = parts[0]
      const image = parts[1] || ''
      if (!name) continue
      if (/^develop-web(-\d+)?$/i.test(name) || /(^|\/)develop-web$/i.test(image)) return `http://${name}:${process.env.HTTP_TEST_PORT || 3000}`
      if (/(^|-)web(-|$|\d)/i.test(name)) return `http://${name}:${process.env.HTTP_TEST_PORT || 3000}`
    }
  } catch (e) {}
  throw new Error('HTTP_TEST_HOST not set and no suitable web container detected via docker ps')
})()

const overrides = {
  appName: 'Overleaf',
  siteUrl: overleafHost,

  enableSubscriptions: true,

  apis: {
    thirdPartyDataStore: {
      url: `http://127.0.0.1:23002`,
      dropboxApp: 'Overleaf',
    },
    analytics: {
      url: `http://127.0.0.1:23050`,
    },
    recurly: {
      url: 'http://127.0.0.1:26034',
      subdomain: 'test',
      apiKey: 'private-nonsense',
      webhookUser: 'recurly',
      webhookPass: 'webhook',
    },

    tpdsworker: {
      // Disable tpdsworker in CI.
      url: undefined,
    },

    v1: {
      url: `http://127.0.0.1:25000`,
      user: 'overleaf',
      pass: 'password',
    },
    tags: {
      url: 'http://127.0.0.1:25000',
    },
  },

  oauthProviders: {
    provider: {
      name: 'provider',
    },
    collabratec: {
      name: 'collabratec',
    },
    google: {
      name: 'google',
    },
  },

  saml: undefined,

  contentful: {
    spaceId: 'a',
    deliveryToken: 'b',
    previewToken: 'c',
    deliveryApiHost: 'cdn.contentful.com',
    previewApiHost: 'preview.contentful.com',
  },

  twoFactorAuthentication: {
    accessTokenEncryptorOptions: {
      cipherPasswords: {
        '2023.1-v3': 'this-is-a-weak-secret-for-tests-web-2023.1-v3',
      },
    },
  },

  overleaf: {
    host: 'http://127.0.0.1:25000',
    oauth: {
      clientID: 'mock-oauth-client-id',
      clientSecret: 'mock-oauth-client-secret',
    },
  },

  analytics: {
    enabled: true,
    hashedEmailSalt: 'acceptance-test-salt',
  },
}

module.exports = baseApp.mergeWith(baseTest.mergeWith(overrides))

for (const redisKey of Object.keys(module.exports.redis)) {
  // Default to the docker-compose service name used in CI/dev compose files when
  // REDIS_HOST is not explicitly set in the environment for the test runner.
  module.exports.redis[redisKey].host = process.env.REDIS_HOST || 'redis'
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
