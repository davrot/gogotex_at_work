import { UserSSHKey } from '../../models/UserSSHKey.js'
import logger from '@overleaf/logger'

export async function lookup(req, res) {
  const fingerprint = req.params.fingerprint
  if (!fingerprint || !fingerprint.trim()) {
    return res.status(400).json({ message: 'fingerprint required' })
  }
  try {
    const key = await UserSSHKey.findOne({ fingerprint }).lean().exec()
    if (!key) return res.status(404).json({})
    return res.status(200).json({ userId: String(key.userId) })
  } catch (err) {
    logger.err({ err, fingerprint }, 'error looking up ssh key fingerprint')
    return res.sendStatus(500)
  }
}

export default { lookup }
