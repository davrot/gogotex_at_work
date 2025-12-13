import { test, expect } from '@playwright/test'
import Path from 'node:path'

test('launchpad create admin, login, and screenshot settings', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:23000'
  const email = `e2e+launchpad+${Date.now()}@example.com`
  const password = process.env.CYPRESS_DEFAULT_PASSWORD || 'Password123!'

  // Navigate to launchpad page and try to register a new admin if registration
  // form is present (only visible when no admin user exists)
  await page.goto(`${base}/launchpad`, { waitUntil: 'networkidle' })

  const registerSelector = 'form[data-ol-register-admin]'
  const registerForm = await page.$(registerSelector)
  if (registerForm) {
    await page.fill(`${registerSelector} input[name="email"]`, email)
    await page.fill(`${registerSelector} input[name="password"]`, password)
    await page.click(`${registerSelector} button[type="submit"]`)
    await page.waitForResponse(resp => resp.url().includes('/launchpad/register_admin') && resp.status() === 200)
    await page.screenshot({ path: Path.join(process.cwd(), 'user_created.png') })
  } else {
    test.skip('launchpad registration form not present (admin already exists)')
  }

  // Now login as the newly created user and capture screenshot
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/project', { timeout: 15000 }).catch(() => {})
  await page.screenshot({ path: Path.join(process.cwd(), 'login_success.png') })

  // Open profile menu and navigate to user settings
  const profileMenu = await page.$('[data-testid="profile-menu"]')
  if (profileMenu) {
    await profileMenu.click()
    await page.click('a[href="/account/settings"]')
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {})
    await page.screenshot({ path: Path.join(process.cwd(), 'user_settings.png') })
  } else {
    // If profile menu doesn't exist, take a fallback full page screenshot
    await page.screenshot({ path: Path.join(process.cwd(), 'user_settings.png') })
  }
})
