#!/usr/bin/env node
// Focused HTTP token round-trip test: create user, create PAT via UI, create project, clone via HTTP using token, modify, push, verify
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'out')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const BASE_URL = process.env.BASE_URL || 'http://develop-webpack-1:3808'
const GIT_HOST = process.env.GIT_HOST || new URL(BASE_URL).hostname
const GIT_PORT = process.env.GIT_PORT || new URL(BASE_URL).port || '80'

async function run() {
  const timestamp = Date.now()
  const email = process.env.TEST_USER_EMAIL || `playwright-token-${timestamp}@example.com`
  const password = process.env.TEST_USER_PASSWORD || `Test!${Math.floor(Math.random()*10000)}`

  // Create user via admin if available
  try { execSync(`node services/web/test/e2e/playwright/run-user-flow.mjs --create-test-user ${email}`, { stdio: 'inherit' }) } catch (e) { console.debug('admin helper unavailable') }

  // Launch Playwright to login and create a PAT
  let playwright
  try { playwright = await import('playwright') } catch (e) { console.error('Playwright not installed'); process.exit(2) }
  const { chromium } = playwright
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  // Register/login flow
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  const regForm = await page.$('form[data-ol-register-admin]')
  if (regForm) {
    await page.fill('form[data-ol-register-admin] input[name="email"]', email)
    await page.fill('form[data-ol-register-admin] input[name="password"]', password)
    await Promise.all([page.click('form[data-ol-register-admin] button[type=submit]'), page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(()=>{})])
  }
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  const emailSelector = await page.$('input[name="email"]') ? 'input[name="email"]' : 'input[name="username"]'
  await page.fill(emailSelector, email)
  await page.fill('input[type="password"]', password)
  await Promise.all([page.click('button[type=submit]'), page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(()=>{})])

  // Create project server-side
  const COMPOSE_FILE = process.env.COMPOSE_FILE || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop/docker-compose.yml'
  const PROJECT_DIR = process.env.PROJECT_DIR || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop'
  // extract user id
  await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
  const userId = await page.$eval('meta[name="ol-user_id"]', el => el.content).catch(()=>null)
  if (!userId) { console.error('No userId available'); await browser.close(); process.exit(3) }
  const pname = `gittest-token-${timestamp}`
  let projectId
  try {
    const out = execSync(`${PROJECT_DIR}/scripts/e2e/create_project_server.sh ${userId} "${pname}"`, { encoding: 'utf8' })
    projectId = out.toString().trim().split('\n').pop()
    console.log('Created project id:', projectId)
  } catch (e) { console.error('Project create failed', e && e.message); await browser.close(); process.exit(4) }

  // Create a token via UI
  try {
    await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
    await page.fill('.git-tokens-panel input', `playwright-token-${timestamp}`)
    await page.click('.git-tokens-panel button[type="submit"]')
    await page.waitForSelector('.git-tokens-panel .new-token pre', { timeout: 5000 })
    const tokenText = await page.$eval('.git-tokens-panel .new-token pre', el => el.textContent?.trim() || '')
    if (!tokenText) throw new Error('Created token not found')
    fs.writeFileSync(path.join(outDir, 'created_token.txt'), tokenText)
    console.log('Created token saved')

    // Clone repo using token over HTTP
    const tmp = `/tmp/playwright_token_work_${timestamp}`
    try { execSync(`rm -rf ${tmp} && mkdir -p ${tmp} && cd ${tmp} && git clone ${BASE_URL.replace('http://','http://git:')}/${projectId}.git .`, { stdio: 'inherit', encoding: 'utf8' }) } catch (e) {
      // Try with token in URL
      const authUrl = `${BASE_URL.replace('http://','http://git:'+encodeURIComponent(tokenText)+'@')}/${projectId}.git`
      try { execSync(`cd ${tmp} && git clone ${authUrl} .`, { stdio: 'inherit', encoding: 'utf8' }) } catch (err) { console.error('http clone failed', err && err.message); await browser.close(); process.exit(5) }
    }

    // Modify a tex file and push using token
    let texFile = null
    try { texFile = execSync(`cd ${tmp}; git ls-files '*.tex' | head -n1`, { encoding: 'utf8' }).trim() } catch (e) {}
    if (!texFile) { texFile = 'main.tex'; fs.writeFileSync(path.join(tmp, texFile), '% test main\n\\documentclass{article}\\begin{document}Hi\\end{document}\n'); execSync(`cd ${tmp} && git add ${texFile} && git commit -m "add ${texFile}" && git push`, { stdio: 'inherit' }) }
    fs.appendFileSync(path.join(tmp, texFile), `\n% appended by playwright token test at ${timestamp}\n`)
    execSync(`cd ${tmp} && git add ${texFile} && git commit -m "append marker" && git push`, { stdio: 'inherit' })

    // Verify server-side (git-bridge container) that HEAD file has the appended marker
    const checkCmd = `docker exec develop-git-bridge-1 bash -lc "cd /data/git-bridge/${projectId} || true; if [ -d /data/git-bridge/${projectId} ]; then git --git-dir=/data/git-bridge/${projectId} show HEAD:${texFile} || true; else echo 'no-repo'; fi"`
    const fileAtHead = execSync(checkCmd, { encoding: 'utf8' }).trim()
    if (!fileAtHead || fileAtHead.includes('no-repo')) { console.error('Server-side repo content not found'); await browser.close(); process.exit(7) }
    if (!fileAtHead.includes('% appended by playwright token test')) { console.error('Appended marker not observed in server-side repo content'); fs.writeFileSync(path.join(outDir, 'server_head_content_token.txt'), fileAtHead); await browser.close(); process.exit(8) }
    console.log('Verified appended marker present on server-side repo (token flow)')

  } catch (e) { console.error('Token roundtrip failed:', e && e.message); await browser.close(); process.exit(6) }

  await browser.close()
  console.log('HTTP token round-trip test completed successfully')
  process.exit(0)
}

run().catch(e => { console.error('Token roundtrip script error', e); process.exit(2) })
