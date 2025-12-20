const { spawnSync } = require('child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' })
  const out = (res.stdout || '') + (res.stderr || '')
  return { status: res.status, out }
}

let ok = true
let r = run('bash', ['scripts/e2e/git-https-acceptance.sh', 'proj1', 'develop-git-bridge', '80'])
if (r.status !== 0) {
  console.error('git-https-acceptance check failed:', r.out)
  ok = false
} else {
  console.log('git-https-acceptance completed (expected non-localhost host)')
}

r = run('bash', ['scripts/e2e/git-ssh-acceptance.sh', 'user123', 'develop-git-bridge', '22'])
if (r.status !== 0) {
  console.error('git-ssh-acceptance check failed:', r.out)
  ok = false
} else {
  console.log('git-ssh-acceptance completed (expected non-localhost host)')
}

process.exit(ok ? 0 : 1)
