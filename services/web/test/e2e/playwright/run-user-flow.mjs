#!/usr/bin/env node
// Run a simple user flow with Playwright and capture screenshots
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'out')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:13000'

async function main() {
  // Optionally reset MongoDB 'users' collection before running the flow.
  // Set RESET_DB=true to delete all users (useful for ensuring registration form is shown).
  if (process.env.RESET_DB === 'true') {
    console.log('RESET_DB=true — deleting users from MongoDB (sharelatex.users)')
    try {
      // Adjust COMPOSE_FILE / PROJECT_DIR via env if needed for different hosts
      const COMPOSE_FILE = process.env.COMPOSE_FILE || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop/docker-compose.yml'
      const PROJECT_DIR = process.env.PROJECT_DIR || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop'
      const { execSync } = await import('node:child_process')
      execSync(`docker compose -f ${COMPOSE_FILE} --project-directory ${PROJECT_DIR} exec -T mongo mongosh --eval "db = db.getSiblingDB('sharelatex'); db.users.deleteMany({})"`, { stdio: 'inherit' })
      console.log('MongoDB users deleted')
    } catch (err) {
      console.error('Failed to reset MongoDB users:', err)
      process.exit(4)
    }
  }

  let playwright
  try {
    playwright = await import('playwright')
  } catch (err) {
    console.error('Playwright is not installed. Install with: npm i -D playwright')
    process.exit(2)
  }

  const { chromium } = playwright
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  // Capture console messages to a log file for debugging
  const consoleMessages = []
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`)
  })

  const timestamp = Date.now()
  const email = `playwright+${timestamp}@example.com`
  const password = `Test1234!${Math.floor(Math.random()*1000)}`

  // Helper: wait for important assets to respond with 200
  async function waitForAssets(page, paths, timeout = 10000) {
    const start = Date.now()
    for (const p of paths) {
      let ok = false
      while (!ok && Date.now() - start < timeout) {
        try {
          const res = await page.evaluate(async (p) => {
            try { const r = await fetch(p, { method: 'GET' }); return { status: r.status, type: r.headers.get('content-type') } } catch (e) { return null }
          }, p)
          if (res && res.status === 200) ok = true
        } catch (e) {}
        if (!ok) await page.waitForTimeout(250)
      }
      if (!ok) throw new Error(`Asset ${p} did not become available within ${timeout}ms`)
    }
  }

  // Helper: wait for any of the provided selectors to appear (UI ready)
  async function waitForUiReady(page, selectors, timeout = 10000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      for (const s of selectors) {
        try {
          const el = await page.$(s)
          if (el) return true
        } catch (e) {}
      }
      await page.waitForTimeout(250)
    }
    throw new Error(`UI markers ${selectors.join(', ')} not found within ${timeout}ms`)
  }

  try {
    console.log('Opening launchpad at', `${BASE_URL}/launchpad`)
    await page.goto(`${BASE_URL}/launchpad`, { waitUntil: 'networkidle' })
    await page.waitForSelector('form[data-ol-register-admin]', { timeout: 15000 })

    await page.fill('form[data-ol-register-admin] input[name="email"]', email)
    await page.fill('form[data-ol-register-admin] input[name="password"]', password)

    // Submit the registration form and wait for the UI to update.
    // The server responds with a JSON redirect; prefer to wait for navigation or a visible change
    await Promise.all([
      page.click('form[data-ol-register-admin] button[type=submit]'),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
    ])

    // If navigation didn't happen, wait for the registration form to disappear or a success message
    try {
      await page.waitForSelector('form[data-ol-register-admin]', { state: 'detached', timeout: 3000 })
    } catch (e) {
      // ignore - fallback to a short delay to allow client-side redirect
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: path.join(outDir, 'user_created.png'), fullPage: true })
    let createdHtml = await page.content()
    fs.writeFileSync(path.join(outDir, 'user_created.html'), createdHtml)
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleMessages.join('\n'))
    console.log('Saved screenshot and HTML:', path.join(outDir, 'user_created.png'), path.join(outDir, 'user_created.html'))

    // If the submission returned JSON (rendered as <pre>{...}</pre>), follow its redirect, then capture a proper UI screenshot
    try {
      const isJsonResponse = await page.$('pre')
      if (isJsonResponse) {
        const preText = await page.$eval('pre', el => el.textContent || '')
        try {
          const data = JSON.parse(preText)
          if (data && data.redir) {
            console.log('Detected JSON redirect to', data.redir, '- following to capture UI')
            await page.goto(`${BASE_URL}${data.redir}`, { waitUntil: 'networkidle' })

            // Wait for key assets and UI markers before taking follow-up screenshot
            await waitForAssets(page, ['/js/runtime.js', '/stylesheets/main-style.css'], 10000)
            await waitForUiReady(page, ['#project-list-root', '#main-content', 'nav.navbar'], 10000)

            await page.screenshot({ path: path.join(outDir, 'user_created_followed.png'), fullPage: true })
            createdHtml = await page.content()
            fs.writeFileSync(path.join(outDir, 'user_created_followed.html'), createdHtml)
            console.log('Saved followed screenshot and HTML:', path.join(outDir, 'user_created_followed.png'), path.join(outDir, 'user_created_followed.html'))
          }
        } catch (e) {
          // not JSON — ignore
        }
      }
    } catch (e) {
      // ignore any errors in this diagnostic step
    }

    // Login
    console.log('Navigating to login')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    // fill email/password - login forms vary, try common selectors
    const emailSelector = await page.$('input[name="email"]')
    if (emailSelector) {
      await page.fill('input[name="email"]', email)
    } else {
      // try username
      await page.fill('input[name="username"]', email)
    }
    await page.fill('input[type="password"]', password)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {}),
      page.click('button[type=submit]'),
    ])

    // Determine whether landing page shows 'Restricted' or a normal project dashboard.
    const landingTitle = await page.title()
    if (landingTitle && landingTitle.includes('Restricted')) {
      console.log('Landing page is Restricted — capturing a clear logged-in view from /user/settings')
      await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
      await waitForAssets(page, ['/js/runtime.js', '/stylesheets/main-style.css'], 10000)
      await waitForUiReady(page, ['#settings-page-root', 'nav.navbar'], 10000)
      await page.screenshot({ path: path.join(outDir, 'login_success.png'), fullPage: true })
    } else {
      await waitForAssets(page, ['/js/runtime.js', '/stylesheets/main-style.css'], 10000)
      await waitForUiReady(page, ['#project-list-root', 'nav.navbar', '#main-content'], 10000)
      await page.screenshot({ path: path.join(outDir, 'login_success.png'), fullPage: true })
    }
    const loginHtml = await page.content()
    fs.writeFileSync(path.join(outDir, 'login_success.html'), loginHtml)
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleMessages.join('\n'))
    console.log('Saved screenshot and HTML:', path.join(outDir, 'login_success.png'), path.join(outDir, 'login_success.html'))

    // Optionally create an extra test user via admin endpoint
    const createTestUser = process.env.CREATE_TEST_USER === 'true' || process.env.TEST_USER_EMAIL
    if (createTestUser) {
      const testEmail = process.env.TEST_USER_EMAIL || `test+${timestamp}@example.com`
      console.log('Creating test user via admin API:', testEmail)
      const resp = await page.evaluate(async (email) => {
        const r = await fetch('/admin/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        return { status: r.status, body: await r.json().catch(() => null) }
      }, testEmail)
      console.log('Admin register response:', resp)
      await page.screenshot({ path: path.join(outDir, 'user_created_by_admin.png'), fullPage: true })
      console.log('Saved screenshot:', path.join(outDir, 'user_created_by_admin.png'))
    }

    // Go to user settings
    await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
    // Some parts of the settings page are rendered client-side; wait a short time for JS to run
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(outDir, 'user_settings.png'), fullPage: true })
    const settingsHtml = await page.content()
    fs.writeFileSync(path.join(outDir, 'user_settings.html'), settingsHtml)
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleMessages.join('\n'))
    console.log('Saved screenshot and HTML:', path.join(outDir, 'user_settings.png'), path.join(outDir, 'user_settings.html'))

    await browser.close()
    console.log('Completed flow successfully')
    process.exit(0)
  } catch (err) {
    console.error('Error during flow:', err)
    await browser.close()
    process.exit(3)
  }
}

main()
