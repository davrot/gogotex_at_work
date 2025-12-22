import { spawnSync } from 'node:child_process'

if (process.env.RUN_DOCKER_SMOKE !== 'true') {
  console.log('Skipping Docker smoke: set RUN_DOCKER_SMOKE=true to run this test')
  process.exit(0)
}

console.log('Running Docker smoke for sandbox-compile... (this may require docker privileges in CI)')
const res = spawnSync('npm', ['run', 'test:sandbox-compile'], { stdio: 'inherit', shell: true })
process.exit(res.status || 1)
