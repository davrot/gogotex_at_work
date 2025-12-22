import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import path from 'path'

const USAGE = `Usage: node tools/seed_token.mjs <userId> [label]
Creates a PersonalAccessToken for userId (dev only) and prints JSON with token and id.`

if (process.argv.length < 3) {
  console.error(USAGE)
  process.exit(2)
}

const userId = process.argv[2]
const label = process.argv[3] || 'contract-token'
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/sharelatex'

try {
  await mongoose.connect(mongoUri, { dbName: 'sharelatex' })
  // Import the manager
  const managersPath = path.join(process.cwd(), 'services', 'web', 'app', 'src', 'Features', 'Token', 'PersonalAccessTokenManager.mjs')
  // dynamic import
  const PAMod = await import(`file://${managersPath}`)
  const PAM = PAMod.default || PAMod
  const res = await PAM.createToken(userId, { label })
  // Normalize id to a plain 24-character hex string when possible so outside scripts can parse reliably
  const out = Object.assign({}, res)
  if (out && out.id && typeof out.id === 'string') {
    const m = out.id.match(/ObjectID\("([0-9a-fA-F]{24})"\)/)
    if (m) out.id = m[1]
  } else if (out && out.id && typeof out.id === 'object' && typeof out.id.toString === 'function') {
    out.id = out.id.toString()
  }
  console.log(JSON.stringify(out))
  await mongoose.disconnect()
  process.exit(0)
} catch (e) {
  console.error('Error creating token via manager:', e && e.stack ? e.stack : e)
  try { await mongoose.disconnect() } catch (er) {}
  process.exit(1)
}