const { spawnSync } = require('child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' })
  const out = (res.stdout || '') + (res.stderr || '')
  return { status: res.status, out }
}

let ok = true
let r = run('bash', ['scripts/e2e/git-https-acceptance.sh', 'proj1', '127.0.0.1', '80'])
if (r.status === 0 || !/must not be localhost|127\.0\.0\.1/.test(r.out)) {
  console.error('git-https-acceptance check failed to block localhost:', r.out)
  ok = false
} else {
  console.log('git-https-acceptance correctly blocked localhost')
}

r = run('bash', ['scripts/e2e/git-ssh-acceptance.sh', 'user123', '127.0.0.1', '22'])
if (r.status === 0 || !/must not be localhost|127\.0\.0\.1/.test(r.out)) {
  console.error('git-ssh-acceptance check failed to block localhost:', r.out)
  ok = false
} else {
  console.log('git-ssh-acceptance correctly blocked localhost')
}

process.exit(ok ? 0 : 1)
