import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './',
  timeout: 30_000,
  outputDir: 'test-results',
  globalSetup: './global-setup.mjs',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:23000',
  },
})
