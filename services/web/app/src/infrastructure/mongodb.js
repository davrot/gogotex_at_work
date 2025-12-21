const mongodb = require('mongodb-legacy')
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const MongoUtils = require('@overleaf/mongo-utils')
const Mongoose = require('./Mongoose')
const { addConnectionDrainer } = require('./GracefulShutdown')

// Ensure Mongoose is using the same mongodb instance as the mongodb module,
// otherwise we will get multiple versions of the ObjectId class. Mongoose
// patches ObjectId, so loading multiple versions of the mongodb module can
// cause problems with ObjectId comparisons.
if (Mongoose.mongo.ObjectId !== mongodb.ObjectId) {
  throw new OError(
    'FATAL ERROR: Mongoose is using a different mongodb instance'
  )
}

const { ObjectId, ReadPreference } = mongodb

const READ_PREFERENCE_PRIMARY = ReadPreference.primary.mode
const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

// Defensive: normalize host in the Mongo URL to prefer the docker 'mongo' service
// when running tests or when MONGO_HOST is set. This helps avoid immediate
// connection attempts to 127.0.0.1 when modules are imported before test
// bootstrap can set env vars.
let mongoUrl = Settings.mongo.url
let mongoClientCreationStack = null
try {
  // capture creation stack so we can trace who created the client
  mongoClientCreationStack = new Error().stack
  try {
    const parsed = new URL(mongoUrl)
    if (parsed.hostname === '127.0.0.1') {
      if (process.env.MONGO_HOST) {
        parsed.hostname = process.env.MONGO_HOST
      } else if (process.env.NODE_ENV === 'test') {
        parsed.hostname = 'mongo'
      }
      mongoUrl = parsed.toString()
    }
  } catch (e) {
    // url parsing failed; fallback to string replace for quick fix
    if (String(mongoUrl).includes('127.0.0.1')) {
      if (process.env.MONGO_HOST) mongoUrl = String(mongoUrl).replace('127.0.0.1', process.env.MONGO_HOST)
      else if (process.env.NODE_ENV === 'test') mongoUrl = String(mongoUrl).replace('127.0.0.1', 'mongo')
    }
  }
} catch (e) {}
// Persist creation info for triage
try { fs.appendFileSync('/tmp/mongo_clients.log', JSON.stringify({ t: new Date().toISOString(), event: 'created', mongoUrl, creationStack: mongoClientCreationStack }) + '\n') } catch (e) {}

const mongoClient = new mongodb.MongoClient(
  mongoUrl,
  Settings.mongo.options
)

// Log errors on the underlying driver and capture connection failures with
// stack traces so we can find the importer or module that triggered the
// connection attempt.
try {
  mongoClient.on && mongoClient.on('error', err => {
    try { fs.appendFileSync('/tmp/mongo_connect_errors.log', JSON.stringify({ t: new Date().toISOString(), event: 'driver_error', err: (err && err.stack) ? err.stack : String(err), mongoUrl, envHost: process.env.MONGO_HOST || null, creationStack: mongoClientCreationStack }) + '\n') } catch (e) {}
  })
} catch (e) {}

const connectionPromise = mongoClient.connect().catch(err => {
  try { fs.appendFileSync('/tmp/mongo_connect_errors.log', JSON.stringify({ t: new Date().toISOString(), event: 'connect_reject', err: (err && err.stack) ? err.stack : String(err), mongoUrl, envHost: process.env.MONGO_HOST || null, creationStack: mongoClientCreationStack }) + '\n') } catch (e) {}
  // rethrow to allow callers to observe the rejection
  throw err
})

addConnectionDrainer('mongodb', async () => {
  await mongoClient.close()
})

const internalDb = mongoClient.db()
const db = {
  contacts: internalDb.collection('contacts'),
  deletedProjects: internalDb.collection('deletedProjects'),
  deletedSubscriptions: internalDb.collection('deletedSubscriptions'),
  deletedUsers: internalDb.collection('deletedUsers'),
  dropboxEntities: internalDb.collection('dropboxEntities'),
  dropboxProjects: internalDb.collection('dropboxProjects'),
  docHistoryIndex: internalDb.collection('docHistoryIndex'),
  docSnapshots: internalDb.collection('docSnapshots'),
  docs: internalDb.collection('docs'),
  feedbacks: internalDb.collection('feedbacks'),
  githubSyncEntityVersions: internalDb.collection('githubSyncEntityVersions'),
  githubSyncProjectStates: internalDb.collection('githubSyncProjectStates'),
  githubSyncUserCredentials: internalDb.collection('githubSyncUserCredentials'),
  globalMetrics: internalDb.collection('globalMetrics'),
  grouppolicies: internalDb.collection('grouppolicies'),
  groupAuditLogEntries: internalDb.collection('groupAuditLogEntries'),
  institutions: internalDb.collection('institutions'),
  messages: internalDb.collection('messages'),
  migrations: internalDb.collection('migrations'),
  notifications: internalDb.collection('notifications'),
  emailNotifications: internalDb.collection('emailNotifications'),
  oauthAccessTokens: internalDb.collection('oauthAccessTokens'),
  oauthApplications: internalDb.collection('oauthApplications'),
  oauthAuthorizationCodes: internalDb.collection('oauthAuthorizationCodes'),
  projectAuditLogEntries: internalDb.collection('projectAuditLogEntries'),
  projectHistoryChunks: internalDb.collection('projectHistoryChunks'),
  projectHistoryFailures: internalDb.collection('projectHistoryFailures'),
  projectHistoryGlobalBlobs: internalDb.collection('projectHistoryGlobalBlobs'),
  projectHistoryLabels: internalDb.collection('projectHistoryLabels'),
  projectHistorySizes: internalDb.collection('projectHistorySizes'),
  projectHistorySyncState: internalDb.collection('projectHistorySyncState'),
  projectInvites: internalDb.collection('projectInvites'),
  projects: internalDb.collection('projects'),
  publishers: internalDb.collection('publishers'),
  rooms: internalDb.collection('rooms'),
  samlCache: internalDb.collection('samlCache'),
  samlLogs: internalDb.collection('samlLogs'),
  spellingPreferences: internalDb.collection('spellingPreferences'),
  splittests: internalDb.collection('splittests'),
  ssoConfigs: internalDb.collection('ssoConfigs'),
  subscriptions: internalDb.collection('subscriptions'),
  surveys: internalDb.collection('surveys'),
  systemmessages: internalDb.collection('systemmessages'),
  tags: internalDb.collection('tags'),
  teamInvites: internalDb.collection('teamInvites'),
  tokens: internalDb.collection('tokens'),
  userAuditLogEntries: internalDb.collection('userAuditLogEntries'),
  users: internalDb.collection('users'),
  onboardingDataCollection: internalDb.collection('onboardingDataCollection'),
  scriptLogs: internalDb.collection('scriptLogs'),
}

async function getCollectionNames() {
  const internalDb = mongoClient.db()

  const collections = await internalDb.collections()
  return collections.map(collection => collection.collectionName)
}

async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

async function dropTestDatabase() {
  await MongoUtils.dropTestDatabase(mongoClient)
}

/**
 * WARNING: Consider using a pre-populated collection from `db` to avoid typos!
 */
async function getCollectionInternal(name) {
  const internalDb = mongoClient.db()
  return internalDb.collection(name)
}

async function waitForDb() {
  await connectionPromise
}

module.exports = {
  db,
  ObjectId,
  connectionPromise,
  waitForDb,
  getCollectionNames,
  getCollectionInternal,
  cleanupTestDatabase,
  dropTestDatabase,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}
