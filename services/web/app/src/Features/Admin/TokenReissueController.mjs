import { db as defaultDb } from '../../infrastructure/mongodb.js'
import AccessTokenEncryptor from '../../../../../../libraries/access-token-encryptor/index.js'
import logger from '@overleaf/logger'

export async function get(req, res) {
  const id = req.params.id
  if (!id) return res.status(400).json({ message: 'id required' })
  try {
    const doc = await defaultDb.personal_access_token_reissues.findOne({ _id: id })
    if (!doc) return res.sendStatus(404)

    // Attempt to decrypt if encryptor configured
    try {
      const cipherPasswords = process.env.ACCESS_TOKEN_CIPHER_PASSWORDS ? JSON.parse(process.env.ACCESS_TOKEN_CIPHER_PASSWORDS) : (process.env.ACCESS_TOKEN_REISSUE_PASSWORD ? { 'reissue-v3': process.env.ACCESS_TOKEN_REISSUE_PASSWORD } : null)
      if (!cipherPasswords) {
        return res.status(200).json({ id: String(doc._id), userId: String(doc.userId), newTokenId: doc.newTokenId, delivered: Boolean(doc.delivered), note: 'encryption not configured' })
      }
      const accessTokenEncryptor = new AccessTokenEncryptor({ cipherPasswords, cipherLabel: Object.keys(cipherPasswords)[0] })
      const payload = await accessTokenEncryptor.promises.decryptToJson(doc.encryptedSecret)
      return res.status(200).json({ id: String(doc._id), userId: String(doc.userId), newTokenId: doc.newTokenId, token: payload.token, delivered: Boolean(doc.delivered) })
    } catch (err) {
      try { logger.err({ err, id }, 'failed to decrypt reissued token') } catch (e) {}
      return res.status(200).json({ id: String(doc._id), userId: String(doc.userId), newTokenId: doc.newTokenId, delivered: Boolean(doc.delivered), note: 'decryption_failed' })
    }
  } catch (err) {
    try { logger.err({ err, id }, 'error fetching reissue doc') } catch (e) {}
    return res.sendStatus(500)
  }
}

export default { get }
