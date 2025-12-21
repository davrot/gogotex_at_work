#!/usr/bin/env node
// Focused SSH delegation parity test: POST via Node internal API (delegates to Go if enabled), verify presence in Go, DELETE via Node and verify removal
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'out')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const BASE_URL = process.env.BASE_URL || 'http://develop-webpack-1:3808'
const GO_BASE = process.env.GO_BASE || 'http://localhost:3900'
const AUTH_SSH_USE_WEBPROFILE_API = process.env.AUTH_SSH_USE_WEBPROFILE_API

async function run() {
  if (AUTH_SSH_USE_WEBPROFILE_API !== 'true') {
    console.log('Skipping ssh delegation parity test: AUTH_SSH_USE_WEBPROFILE_API is not set to "true"')
    process.exit(0)
  }

  const timestamp = Date.now()
  const email = process.env.TEST_USER_EMAIL || `playwright-ssh-delegate-${timestamp}@example.com`
  const password = process.env.TEST_USER_PASSWORD || `Test!${Math.floor(Math.random()*10000)}`

  // Create keypair
  const tmpBase = `/tmp/playwright_ssh_delegate_${timestamp}`
  try { execSync(`ssh-keygen -t rsa -b 2048 -f ${tmpBase} -N '' -C 'playwright-e2e-delegation'`, { stdio: 'ignore' }) } catch (e) {}
  const pub = fs.readFileSync(tmpBase + '.pub', 'utf8').trim()

  // Ensure user exists and we can obtain userId and csrf token via run-user-flow or UI
  let userId = null
  let csrf = null
  try {
    execSync(`node services/web/test/e2e/playwright/run-user-flow.mjs --create-test-user ${JSON.stringify(email)}`, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] })
    const saved = 'services/web/test/e2e/playwright/out/user_settings.html'
    if (fs.existsSync(saved)) {
      const html = fs.readFileSync(saved, 'utf8')
      const mId = html.match(/<meta name="ol-user_id" content="([^"]+)"/)
      const mCsrf = html.match(/<meta name="ol-csrfToken" content="([^"]+)"/)
      if (mId) userId = mId[1]
      if (mCsrf) csrf = mCsrf[1]
    }
  } catch (e) {
    console.debug('run-user-flow failed, will use UI flow in Playwright as fallback')
  }

  // If no userId, perform UI flow and capture CSRF via Playwright
  let browser
  try {
    const playwright = await import('playwright')
    const { chromium } = playwright
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()

    if (!userId) {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' }).catch(()=>{})
      // Attempt registration if form present
      const regForm = await page.$('form[data-ol-register-admin]')
      if (regForm) {
        await page.fill('form[data-ol-register-admin] input[name="email"]', email)
        await page.fill('form[data-ol-register-admin] input[name="password"]', password)
        await Promise.all([page.click('form[data-ol-register-admin] button[type=submit]'), page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(()=>{})])
      }

      // Login
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
      const emailSelector = await page.$('input[name="email"]') ? 'input[name="email"]' : 'input[name="username"]'
      await page.fill(emailSelector, email)
      await page.fill('input[type="password"]', password)
      await Promise.all([page.click('button[type=submit]'), page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(()=>{})])

      // Get user id and csrf token from settings page
      await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
      try { await page.waitForSelector('meta[name="ol-user_id"]', { timeout: 5000 }) } catch (e) {}
      const userMetaId = await page.$eval('meta[name="ol-user_id"]', el => el.content).catch(()=>null)
      const csrfMeta = await page.$eval('meta[name="ol-csrfToken"]', el => el.content).catch(()=>null)
      if (!userMetaId) { console.error('Failed to get user id via UI flow'); await browser.close(); process.exit(3) }
      userId = userMetaId
      csrf = csrfMeta
    }

    // POST SSH key via Node internal API (delegation should happen server-side)
    const createKeyRes = await page.evaluate(async ({ userId, csrf, pub }) => {
      const r = await fetch(`/internal/api/users/${userId}/ssh-keys`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': csrf }, body: JSON.stringify({ key_name: 'delegation-test', public_key: pub }) })
      const body = await r.text().catch(()=>null)
      return { status: r.status, body }
    }, { userId, csrf, pub })

    console.log('Node create response status:', createKeyRes.status)
    if (![200,201].includes(createKeyRes.status)) { console.error('Node create failed:', createKeyRes); await browser.close(); process.exit(4) }
    let parsed = null
    try { parsed = JSON.parse(createKeyRes.body) } catch (e) { /* ignore */ }
    const returnedFingerprint = parsed && (parsed.fingerprint || parsed.fingerprint)
    const returnedId = parsed && (parsed.id || parsed.id)
    if (!returnedFingerprint) {
      console.warn('Create returned no fingerprint; will compute expected fingerprint from pub')
    }

    // Poll Go endpoint to check that the key is visible via webprofile API
    const maxAttempts = 20
    let seen = false
    let goList = null
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const u = `${GO_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/ssh-keys`
        const res = await fetch(u, { method: 'GET', headers: { Authorization: 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } })
        const status = res.status
        const txt = await res.text().catch(()=>null)
        if (status === 200 && txt) {
          goList = JSON.parse(txt)
          const has = goList.some(k => {
            if (returnedFingerprint && k.fingerprint === returnedFingerprint) return true
            if (k.public_key && pub && k.public_key.trim() === pub.trim()) return true
            return false
          })
          if (has) { seen = true; break }
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000))
    }
    if (!seen) {
      console.error('Delegated SSH key not found in Go list after polling')
      try { fs.writeFileSync(path.join(outDir, 'go_list.txt'), JSON.stringify(goList || [])) } catch (e) {}
      await browser.close(); process.exit(5)
    }
    console.log('Delegated SSH key visible in Go webprofile list')

    // Now DELETE via Node internal API (as same logged-in user)
    const deleteRes = await page.evaluate(async ({ userId, csrf, keyId }) => {
      const r = await fetch(`/internal/api/users/${userId}/ssh-keys/${keyId}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Csrf-Token': csrf } })
      return { status: r.status }
    }, { userId, csrf, keyId: returnedId || (goList && goList[0] && goList[0].id) })

    console.log('Node delete response status:', deleteRes.status)
    if (![200,204].includes(deleteRes.status)) { console.error('Node delete failed', deleteRes); await browser.close(); process.exit(6) }

    // Poll Go list to ensure key removed
    let stillThere = false
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const u = `${GO_BASE.replace(/\/$/, '')}/internal/api/users/${encodeURIComponent(userId)}/ssh-keys`
        const res = await fetch(u, { method: 'GET', headers: { Authorization: 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64') } })
        const status = res.status
        const txt = await res.text().catch(()=>null)
        if (status === 200 && txt) {
          const list = JSON.parse(txt)
          const has = list.some(k => k.fingerprint === returnedFingerprint || (k.public_key && pub && k.public_key.trim() === pub.trim()))
          if (!has) { stillThere = false; break }
          stillThere = true
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000))
    }
    if (stillThere) {
      console.error('Delegated SSH key still present in Go list after deletion')
      await browser.close(); process.exit(7)
    }
    console.log('Delegated SSH key successfully removed from Go webprofile list')

    await browser.close()
    console.log('SSH delegation parity test completed successfully')
    process.exit(0)
  } catch (e) {
    console.error('E2E test failed:', e && (e.stack || e.message || e))
    try { if (browser) await browser.close() } catch (e2) {}
    process.exit(2)
  }
}

run().catch(err => { console.error('ssh delegation parity script failed:', err); process.exit(2) })
