import path from 'node:path'

const projectRoot = path.resolve(new URL(import.meta.url).pathname, '../../')
console.error('DEBUG running debug-remove script, projectRoot=', projectRoot)

// Monkey patch the model file directly
// load model file and patch
const modelPath = '../services/web/app/src/models/UserSSHKey.js'
let model = await import(modelPath)
console.error('DEBUG loaded model, keys=', Object.keys(model))
const UserSSHKey = model.UserSSHKey || model.default
console.error('DEBUG UserSSHKey initial typeof', typeof UserSSHKey)

UserSSHKey.findOneAndDelete = (query) => { console.error('MOCK findOneAndDelete called with', query); return { exec: async () => ({ _id: 'k1', fingerprint: 'SHA256:AAAA', userId: query.userId }) } }

// load controller
const Controller = await import('../services/web/app/src/Features/User/UserSSHKeysController.mjs')
console.error('DEBUG controller.remove source contains marker', Controller.remove.toString().includes('findOneAndDelete typeof'))

const req = { params: { userId: '000000000000000000000001', keyId: 'k1' }, session: {} }
const res = {
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(obj) { this.body = JSON.stringify(obj); return this },
  sendStatus(code) { this.statusCode = code; return this },
}

try {
  await Controller.remove(req, res)
  console.error('DEBUG remove completed, res.statusCode=', res.statusCode, 'res.body=', res.body)
} catch (err) {
  console.error('DEBUG remove threw', err && err.stack ? err.stack : err)
}
