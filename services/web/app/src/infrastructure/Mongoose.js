const mongoose = require('mongoose')
const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const { addConnectionDrainer } = require('./GracefulShutdown')

mongoose.set('autoIndex', false)
mongoose.set('strictQuery', false)

const connectionPromise = mongoose.connect(
  Settings.mongo.url,
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
  })

addConnectionDrainer('mongoose', async () => {
  await connectionPromise
  await mongoose.disconnect()
})

mongoose.connection.on('connected', () =>
  logger.debug('mongoose default connection open')
)

mongoose.connection.on('error', err =>
  logger.err({ err }, 'mongoose error on default connection')
)

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

// Allow idempotent model registration across multiple require/import paths
// (useful for development images where the same file may be available under
// both app/src and app/, or when modules are reloaded). If a model is already
// registered with mongoose, return it instead of throwing OverwriteModelError.
const _origModel = mongoose.model.bind(mongoose)
mongoose.model = function modelWrapper(name, schema, collection, skipInit) {
  if (this.models && this.models[name]) {
    return this.models[name]
  }
  return _origModel(name, schema, collection, skipInit)
}

module.exports = mongoose
