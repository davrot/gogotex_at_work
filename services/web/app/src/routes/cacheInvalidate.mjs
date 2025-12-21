import logger from '@overleaf/logger'
import { publish } from '../../../lib/pubsub.js'

export default async function cacheInvalidate(req, res) {
  const { channel, key } = req.body || {}
  if (!channel || !key) return res.status(400).json({ message: 'channel and key required' })
  try {
    const ok = publish(channel, { key })
    if (!ok) {
      logger.err({ channel, key }, 'failed to publish cache invalidation')
      return res.sendStatus(500)
    }
    return res.sendStatus(204)
  } catch (err) {
    logger.err({ err, channel, key }, 'error handling cache invalidate')
    return res.sendStatus(500)
  }
}
