const mongoose = require('mongoose')
const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const { addConnectionDrainer } = require('./GracefulShutdown')

mongoose.set('autoIndex', false)
mongoose.set('strictQuery', false)

// sanitize Mongo URL to avoid accidental local 127.0.0.1 connects in test env
function sanitizeMongoUrl(url) {
  let mongoUrl = url
  try {
    const parsed = new URL(mongoUrl)
    if (parsed.hostname === '127.0.0.1') {
      if (process.env.MONGO_HOST) parsed.hostname = process.env.MONGO_HOST
      else if (process.env.NODE_ENV === 'test') parsed.hostname = 'mongo'
      mongoUrl = parsed.toString()
    }
  } catch (e) {
    if (String(mongoUrl).includes('127.0.0.1')) {
      if (process.env.MONGO_HOST) mongoUrl = String(mongoUrl).replace('127.0.0.1', process.env.MONGO_HOST)
      else if (process.env.NODE_ENV === 'test') mongoUrl = String(mongoUrl).replace('127.0.0.1', 'mongo')
    }
  }
  return mongoUrl
}

const mongooseConnectUrl = Settings && Settings.mongo && Settings.mongo.url ? sanitizeMongoUrl(Settings.mongo.url) : null
try { require('fs').appendFileSync('/tmp/mongo_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'mongoose_connect', url: mongooseConnectUrl, stack: new Error().stack }) + '\n') } catch (e) {}

let connectionPromise
if (mongooseConnectUrl) {
  connectionPromise = mongoose.connect(
    mongooseConnectUrl,
    Settings.mongo.options
  )

  connectionPromise
    .then(mongooseInstance => {
      Metrics.mongodb.monitor(mongooseInstance.connection.client)
    })
    .catch(error => {
      logger.error(
        { error },
        'Failed to connect to MongoDB - cannot set up monitoring'
      )
      try { require('fs').appendFileSync('/tmp/mongo_connect_errors.log', JSON.stringify({ t: new Date().toISOString(), event: 'mongoose_connect_reject', err: (error && error.stack) ? error.stack : String(error), mongoUrl: Settings && Settings.mongo && Settings.mongo.url, envHost: process.env.MONGO_HOST || null, stack: new Error().stack }) + '\n') } catch (e) {}
    })
} else {
  connectionPromise = Promise.resolve()
}

addConnectionDrainer('mongoose', async () => {
  await connectionPromise
  await mongoose.disconnect()
})

mongoose.connection.on('connected', () =>
  logger.debug('mongoose default connection open')
)

mongoose.connection.on('error', err => {
  logger.err({ err }, 'mongoose error on default connection')
  try { require('fs').appendFileSync('/tmp/mongo_connect_errors.log', JSON.stringify({ t: new Date().toISOString(), event: 'mongoose_error', err: (err && err.stack) ? err.stack : String(err), mongoUrl: Settings.mongo.url, envHost: process.env.MONGO_HOST || null, stack: new Error().stack }) + '\n') } catch (e) {}
})

mongoose.connection.on('disconnected', () =>
  logger.debug('mongoose default connection disconnected')
)

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', (collectionName, method, query, doc) =>
    logger.debug({ collectionName, method, query, doc }, 'mongoose debug')
  )
}

mongoose.plugin(schema => {
  schema.options.usePushEach = true
})

mongoose.Promise = global.Promise

mongoose.connectionPromise = connectionPromise

module.exports = mongoose
