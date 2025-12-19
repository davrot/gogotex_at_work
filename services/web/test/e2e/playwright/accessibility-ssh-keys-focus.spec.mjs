import { test, expect } from '@playwright/test'

// Accessibility focus-order test for SSH Keys panel (T013)
// Verifies keyboard navigation order: Label -> Public Key -> Add button

test('SSH Keys panel keyboard navigation order', async ({ page }) => {
  await page.goto(process.env.BASE_URL || 'http://localhost:3808/settings')

  // Wait for SSH Keys panel
  await page.waitForSelector('text=SSH Keys')

  // Focus label input
  await page.focus('[aria-label="SSH key label"]')
  // Tab to public key textarea
  await page.keyboard.press('Tab')
  const focused1 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  expect(focused1).toBe('SSH public key')

  // Tab to Add button
  await page.keyboard.press('Tab')
  const focused2 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  expect(focused2).toBe('Add SSH key')
})