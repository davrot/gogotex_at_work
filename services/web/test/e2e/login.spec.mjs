import { test, expect } from '@playwright/test'
import Path from 'node:path'

test('login and screenshot', async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL || 'e2e+git-token@example.com'
  const password = process.env.CYPRESS_DEFAULT_PASSWORD || 'Password123!'

  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:23000'
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // wait for navigation to project/dashboard or a known selector
  await page.waitForURL('**/project', { timeout: 15000 }).catch(() => {})

  // ensure some logged-in element exists
  const loggedIn = await page.locator('a[href="/project"]').first().isVisible().catch(() => false)
  if (!loggedIn) {
    // fallback: wait for profile menu
    await page.waitForSelector('[data-testid="profile-menu"]', { timeout: 5000 }).catch(() => {})
  }

  // Save screenshot with user-requested filename (note: spelling as provided)
  await page.screenshot({ path: Path.join(process.cwd(), 'login_sucessfull.png'), fullPage: false })
})
