#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'out')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const BASE_URL = process.env.BASE_URL || 'http://develop-webpack-1:3808'
const EMAIL = process.env.TEST_USER_EMAIL
const PASSWORD = process.env.TEST_USER_PASSWORD
const EXPECTED = Number(process.env.EXPECTED_SSH_KEYS || 2)
const CHECK_SSH = process.env.CHECK_SSH_KEYS === 'true'

if (!EMAIL || !PASSWORD) {
  console.error('Please set TEST_USER_EMAIL and TEST_USER_PASSWORD')
  process.exit(2)
}

async function main() {
  let playwright
  try { playwright = await import('playwright') } catch (e) { console.error('Playwright missing'); process.exit(2) }
  const { chromium } = playwright
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  try {
    console.log('Logging in as', EMAIL)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    // try common selectors
    const emailSel = await page.$('input[name="email"]') ? 'input[name="email"]' : 'input[name="username"]'
    await page.fill(emailSel, EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await Promise.all([
      page.click('button[type=submit]'),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(()=>{}),
    ])
    await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // Add two keys via UI
    for (const i of [1,2]) {
      const label = `playwright-key-${i}`
      const key = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplekeydata${i} key${i}@local`
      await page.fill('input[aria-label="SSH key label"]', label)
      await page.fill('textarea[aria-label="SSH public key"]', key)
      await page.click('button[aria-label="Add SSH key"]')
      // wait for POST response or row
      await page.waitForResponse(r => r.url().includes('/internal/api/users/') && r.url().includes('/ssh-keys') && r.request().method() === 'POST', { timeout: 5000 }).catch(()=>{})
      await page.waitForTimeout(500)
    }

    await page.screenshot({ path: path.join(outDir, 'user_settings_with_ssh_keys.png'), fullPage: true })
    fs.writeFileSync(path.join(outDir, 'user_settings_with_ssh_keys.html'), await page.content())
    console.log('Saved UI screenshot and HTML')

    if (CHECK_SSH) {
      const userId = await page.$eval('meta[name="ol-user_id"]', el => el.content).catch(()=>null)
      if (!userId) throw new Error('ol-user_id not found on settings page')
      console.log('Checking MongoDB for user', userId)
      // If running inside the web container, query the app's DB via its models instead of trying to exec docker.
      // Direct DB check using the app's models (works when running inside the web container)
      const { waitForDb, ObjectId } = await import('../../../app/src/infrastructure/mongodb.js')
      await waitForDb()
      const { UserSSHKey } = await import('../../../app/src/models/UserSSHKey.js')
      const keys = await UserSSHKey.find({ userId: new ObjectId(userId) }).lean().exec()
      if (!Array.isArray(keys) || keys.length < EXPECTED) throw new Error(`Expected at least ${EXPECTED} SSH keys, found ${keys.length}`)
      console.log(`Found ${keys.length} SSH keys for user ${userId}`)
    }

    await browser.close()
    process.exit(0)
  } catch (err) {
    console.error('Error in add_ssh_keys flow:', err)
    await page.screenshot({ path: path.join(outDir, 'user_settings_error.png'), fullPage: true }).catch(()=>{})
    fs.writeFileSync(path.join(outDir, 'user_settings_error.html'), await page.content().catch(()=>''))
    await browser.close()
    process.exit(3)
  }
}

main()
