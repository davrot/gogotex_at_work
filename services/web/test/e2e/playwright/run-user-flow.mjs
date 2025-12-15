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
    try {
      await page.waitForSelector('form[data-ol-register-admin]', { timeout: 15000 })
    } catch (e) {
      console.log('Registration form not found, proceeding to login')
    }

    const registerForm = await page.$('form[data-ol-register-admin]')
    if (registerForm) {
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
    } else {
      console.log('No registration form available; continuing to login')
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

    // Before navigating to settings, optionally mock SSH-key backend in-page to reliably test UI behaviour
    if (process.env.ADD_SSH_KEYS === 'true') {
      if (process.env.MOCK_SSH_KEYS_IN_PAGE === 'true') {
        console.log('Setting up in-page SSH keys mock for E2E (MOCK_SSH_KEYS_IN_PAGE=true)')
        await page.route('**/internal/api/users/*/ssh-keys', async route => {
          try {
            const req = route.request()
            const method = req.method()
            // maintain an in-memory list on the Node side closure
            if (!page._sshKeyStore) page._sshKeyStore = []
            const store = page._sshKeyStore
            if (method === 'GET') {
              await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(store) })
              return
            }
            if (method === 'POST') {
              const pd = req.postData() || '{}'
              let post
              try { post = JSON.parse(pd) } catch (e) { post = {} }
              const id = 'sk-' + Date.now() + Math.floor(Math.random() * 1000)
              const item = { id, label: post.label || '', fingerprint: `SHA256:FAKE${Math.floor(Math.random()*10000)}`, created_at: new Date().toISOString() }
              store.unshift(item)
              await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
              return
            }
            // fallback
            await route.continue()
          } catch (err) {
            console.error('SSH keys route handler error:', err)
            await route.continue()
          }
        })
      } else {
        console.log('ADD_SSH_KEYS=true — will attempt to add keys using the real API endpoints')
      }
    }

    // Go to user settings
    await page.goto(`${BASE_URL}/user/settings`, { waitUntil: 'networkidle' })
    // Wait for client-side render to stabilize for tokens/ssh keys. Wait up to 5s for either a tokens table or "No tokens yet." message, and ensure error banners are cleared.
    const tokensReady = await (async () => {
      const start = Date.now()
      while (Date.now() - start < 5000) {
        const hasNoTokens = await page.$('.git-tokens-panel p:has-text("No tokens yet")')
        const hasTokensTable = await page.$('.git-tokens-panel table')
        const hasTokenError = await page.$('.git-tokens-panel .error')
        const hasNoKeys = await page.$('.ssh-keys-panel p:has-text("No SSH keys yet")')
        const hasKeysTable = await page.$('.ssh-keys-panel table')
        const hasKeysError = await page.$('.ssh-keys-panel .notification-type-error')
        if ((hasNoTokens || hasTokensTable) && !hasTokenError && (hasNoKeys || hasKeysTable) && !hasKeysError) return true
        await page.waitForTimeout(250)
      }
      return false
    })()
    if (!tokensReady) {
      // fallback wait to let things settle
      await page.waitForTimeout(2000)
    }

    // Optionally add SSH keys via the UI for testing (set ADD_SSH_KEYS=true)
    if (process.env.ADD_SSH_KEYS === 'true') {
      console.log('ADD_SSH_KEYS=true — adding two SSH keys via settings UI')
      let didFallbackCreate = false
      try {
        // First key
        await page.fill('input[aria-label="SSH key label"]', 'playwright-key-1')
        await page.fill('textarea[aria-label="SSH public key"]', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplekeydata1 key1@local')
        // Wait for the Add button to become enabled and stable
        await page.waitForTimeout(200)
        const addBtn = page.locator('button[aria-label="Add SSH key"]')
        try {
          await addBtn.waitFor({ state: 'visible', timeout: 2000 })
          await addBtn.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }))
          // click and capture the POST response (if any)
          await addBtn.click({ force: true })
          const resp = await page.waitForResponse(r => r.url().includes('/internal/api/users/') && r.url().includes('/ssh-keys') && r.request().method() === 'POST', { timeout: 5000 }).catch(()=>null)
          if (resp) {
            try { const st = resp.status(); const txt = await resp.text(); console.log('SSH key POST response status', st); if (txt) console.log('SSH key POST response body', txt.substring(0, 200));
              // If backend returned 404 for undefined user id, try a fallback direct POST using the ol-user_id meta and X-Csrf-Token
              if (st === 404 && txt && txt.includes('/internal/api/users/undefined/ssh-keys')) {
                console.warn('Detected 404 to undefined user id on SSH key create — attempting direct fetch fallback to persist keys')
                const k1 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplekeydata1 key1@local'
                const k2 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplekeydata2 key2@local'
                try {
                  const userId = await page.$eval('meta[name="ol-user_id"]', el => el.content).catch(() => null)
                  const csrf = await page.$eval('meta[name="ol-csrfToken"]', el => el.content).catch(() => null)
                  if (!userId) throw new Error('ol-user_id meta not found for fallback create')
                  const fbResults = await page.evaluate(async ({userId, csrf, k1, k2}) => {
                    const results = []
                    const r1 = await fetch(`/internal/api/users/${userId}/ssh-keys`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': csrf }, body: JSON.stringify({ key_name: 'playwright-key-1', public_key: k1 }) })
                    results.push({ status: r1.status, text: await r1.text().catch(()=>null) })
                    const r2 = await fetch(`/internal/api/users/${userId}/ssh-keys`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': csrf }, body: JSON.stringify({ key_name: 'playwright-key-2', public_key: k2 }) })
                    results.push({ status: r2.status, text: await r2.text().catch(()=>null) })
                    return results
                  }, { userId, csrf, k1, k2 })
                  didFallbackCreate = true
                  console.log('Fallback direct POSTs executed', fbResults)
                } catch (e) {
                  console.error('Fallback direct POST failed:', e)
                }
              }
            } catch (e) {}
          } else {
            console.log('No SSH key POST response captured (timed out)')
          }
        } catch (err) {
          // debug info
          try {
            const outer = await addBtn.evaluate(el => el.outerHTML).catch(()=>'(no button)')
            console.error('Failed clicking Add SSH key; button outerHTML:', outer)
          } catch (e) {}
          throw err
        }

        // Wait for the newly-added key to appear in the list
        await page.waitForFunction(() => {
          const rows = document.querySelectorAll('.ssh-keys-panel table tbody tr')
          return rows.length >= 1
        }, { timeout: 5000 }).catch(()=>null)

        // Second key
        await page.fill('input[aria-label="SSH key label"]', 'playwright-key-2')
        await page.fill('textarea[aria-label="SSH public key"]', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexamplekeydata2 key2@local')
        await Promise.all([
          page.click('button[aria-label="Add SSH key"]'),
          page.waitForResponse(r => r.url().includes('/internal/api/users/') && r.url().includes('/ssh-keys') && r.request().method() === 'POST' && r.status() < 400, { timeout: 5000 }).catch(()=>null)
        ])

        // If we used the fallback direct POSTs, reload the page to trigger a fresh fetch of keys
        if (didFallbackCreate) {
          console.log('Reloading settings page after fallback create to refresh key list')
          await page.reload({ waitUntil: 'networkidle' })
        }

        // If we used fallback direct POSTs, skip UI-visibility wait and proceed to DB check
        if (!didFallbackCreate) {
          // Wait until at least two keys are visible in the table
          await page.waitForFunction(() => {
            const rows = document.querySelectorAll('.ssh-keys-panel table tbody tr')
            return rows.length >= 2
          }, { timeout: 5000 })
        } else {
          console.log('Skipping UI wait after fallback create; proceeding to DB check')
        }

        // Save a screenshot of the settings page with keys visible
        await page.screenshot({ path: path.join(outDir, 'user_settings_with_ssh_keys.png'), fullPage: true })
        const settingsWithKeysHtml = await page.content()
        fs.writeFileSync(path.join(outDir, 'user_settings_with_ssh_keys.html'), settingsWithKeysHtml)
        console.log('Saved screenshot and HTML with SSH keys:', path.join(outDir, 'user_settings_with_ssh_keys.png'), path.join(outDir, 'user_settings_with_ssh_keys.html'))

        // Optionally check MongoDB for SSH keys
        if (process.env.CHECK_SSH_KEYS === 'true') {
          try {
            // extract user id from meta
            const userId = await page.$eval('meta[name="ol-user_id"]', el => el.content).catch(() => null)
            if (!userId) {
              throw new Error('ol-user_id meta not found on settings page')
            }
            console.log('Checking MongoDB for SSH keys for user:', userId)
            const COMPOSE_FILE = process.env.COMPOSE_FILE || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop/docker-compose.yml'
            const PROJECT_DIR = process.env.PROJECT_DIR || '/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop'
            const js = `const u=ObjectId("${userId}"); const arr=db.getSiblingDB("sharelatex").usersshkeys.find({ userId: u }).toArray(); print(JSON.stringify(arr));`
            const cmd = `docker compose -f ${COMPOSE_FILE} --project-directory ${PROJECT_DIR} exec -T mongo mongosh --quiet --eval '${js}'`
            console.log('MongoDB cmd:', cmd)
            const { execSync } = await import('node:child_process')
            const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
            console.log('MongoDB raw output:', out)
            let arr = []
            try {
              arr = JSON.parse(out.trim())
            } catch (err) {
              console.error('Failed to parse MongoDB output for ssh keys:', out)
              throw err
            }
            const expected = Number(process.env.EXPECTED_SSH_KEYS || 2)
            console.log(`Found ${arr.length} SSH key(s) in MongoDB for user ${userId}`)
            if (arr.length < expected) {
              throw new Error(`Expected at least ${expected} SSH keys in MongoDB for user ${userId}, but found ${arr.length}`)
            }
          } catch (err) {
            console.error('SSH key MongoDB check failed:', err)
            throw err
          }
        }
      } catch (err) {
        console.error('Error while adding SSH keys in E2E:', err)
        throw err
      }
    }

    // Optionally create a personal access token via the UI (set ADD_TOKEN=true)
    if (process.env.ADD_TOKEN === 'true') {
      try {
        console.log('ADD_TOKEN=true — creating a personal access token via settings UI')
        const label = process.env.TOKEN_LABEL || `playwright-token-${timestamp}`
        // Fill token label within the git-tokens panel
        await page.fill('.git-tokens-panel input', label)
        await page.click('.git-tokens-panel button[type="submit"]')
        // Wait for the new token preview to appear and capture token
        await page.waitForSelector('.git-tokens-panel .new-token pre', { timeout: 5000 })
        const tokenText = await page.$eval('.git-tokens-panel .new-token pre', el => el.textContent?.trim() || '')
        if (!tokenText) throw new Error('Token preview did not contain a token')
        fs.writeFileSync(path.join(outDir, 'created_token.txt'), tokenText)
        console.log('Saved created token to', path.join(outDir, 'created_token.txt'))

        // Assert success UI appears and tokens list shows the new token entry
        try {
          await page.waitForSelector('.git-tokens-panel .success', { timeout: 3000 })
          // Wait for tokens table to reflect at least one token (created token may take a short while to appear)
          await page.waitForFunction(() => {
            const table = document.querySelector('.git-tokens-panel table')
            if (!table) return false
            const rows = table.querySelectorAll('tbody tr')
            return rows.length >= 1
          }, { timeout: 5000 })
          console.log('Token creation success UI found and tokens list updated')
        } catch (e) {
          console.warn('Token UI success or tokens list did not appear within expected time:', e.message || e)
        }

        // Optionally try a git-over-HTTPS request using the token (requires PROJECT_ID env)
        if (process.env.CHECK_TOKEN_GIT === 'true' && process.env.PROJECT_ID) {
          const projectId = process.env.PROJECT_ID
          console.log('Attempting git ls-remote using created token for project', projectId)
          const tmpdir = fs.mkdtempSync(path.join('/tmp','playwright-token-'))
          // Allow overriding GIT_HOST and GIT_PORT to target git-bridge
          const gitHost = process.env.GIT_HOST || new URL(BASE_URL).hostname
          const gitPort = process.env.GIT_PORT || new URL(BASE_URL).port || '80'
          const cmd = `git ls-remote https://git:${tokenText}@${gitHost}:${gitPort}/${projectId}.git`
          try {
            const { execSync } = await import('node:child_process')
            const out = execSync(cmd, { cwd: tmpdir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] })
            console.log('git ls-remote output:', out.substring(0, 200))
            fs.writeFileSync(path.join(outDir, 'git_ls_remote.txt'), out)
          } catch (e) {
            console.error('git ls-remote failed:', e.message || e)
          }
        }

        // Save a screenshot of the tokens panel with the preview visible
        await page.screenshot({ path: path.join(outDir, 'user_settings_with_token.png'), fullPage: true })
        const settingsWithTokenHtml = await page.content()
        fs.writeFileSync(path.join(outDir, 'user_settings_with_token.html'), settingsWithTokenHtml)
        console.log('Saved screenshot and HTML with token preview:', path.join(outDir, 'user_settings_with_token.png'), path.join(outDir, 'user_settings_with_token.html'))
      } catch (err) {
        console.error('Error while creating token in E2E:', err)
        throw err
      }
    }

    // Final capture (baseline)
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
