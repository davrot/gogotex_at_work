import { UserSSHKey } from '../../models/UserSSHKey.js'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'

export async function lookup(req, res) {
  const timer = new metrics.Timer('ssh.key_lookup')
  const fingerprint = req.params.fingerprint
  if (!fingerprint || !fingerprint.trim()) {
    timer.done()
    return res.status(400).json({ message: 'fingerprint required' })
  }
  // Validate canonical fingerprint format: 'SHA256:<base64>' with 44 character base64 payload
  if (!fingerprint.startsWith('SHA256:')) {
    timer.done()
    return res.status(400).json({ message: 'invalid fingerprint format' })
  }
  const base = fingerprint.slice(7)
  // RFC: SHA256 digest is 32 bytes encoded into base64 = 44 characters
  if (!/^[A-Za-z0-9+/]+=*$/.test(base) || base.length !== 44) {
    timer.done()
    return res.status(400).json({ message: 'invalid fingerprint format' })
  }
  try {
    const key = await UserSSHKey.findOne({ fingerprint }).lean().exec()
    if (!key) {
      timer.done()
      metrics.inc('ssh.key_lookup.miss', 1)
      return res.status(404).json({})
    }
    metrics.inc('ssh.key_lookup.hit', 1)
    timer.done()
    return res.status(200).json({ userId: String(key.userId) })
  } catch (err) {
    logger.err({ err, fingerprint }, 'error looking up ssh key fingerprint')
    metrics.inc('ssh.key_lookup.error', 1)
    timer.done()
    return res.sendStatus(500)
  }
}

export default { lookup }
