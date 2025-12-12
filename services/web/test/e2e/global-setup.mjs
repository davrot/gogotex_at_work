import { spawn } from 'node:child_process'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))
const repoRoot = Path.resolve(__dirname, '..', '..', '..')
const script = Path.join(repoRoot, 'services', 'web', 'scripts', 'e2e_test_setup.mjs')

export default async function globalSetup() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [script], {
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'inherit',
    })

    proc.on('error', err => reject(err))
    proc.on('exit', code => {
      if (code === 0) return resolve()
      return reject(new Error(`e2e_test_setup exited with code ${code}`))
    })
  })
}
