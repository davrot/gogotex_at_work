const RedisWrapper = require('../app/src/infrastructure/RedisWrapper')
const logger = require('@overleaf/logger')

function publish(channel, message) {
  try {
    const client = RedisWrapper.client('pubsub')
    const payload = typeof message === 'string' ? message : JSON.stringify(message)
    client.publish(channel, payload)
    return true
  } catch (err) {
    logger.err({ err, channel, message }, 'pubsub.publish failed')
    return false
  }
}

module.exports = { publish }
