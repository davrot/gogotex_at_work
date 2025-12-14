#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')

const docsPath = path.resolve(path.join(__dirname, '../../../', 'docs', 'dev-setup.md'))

function printReminder() {
  console.log('\n================================================================')
  console.log('Playwright E2E pre-run check')
  console.log('================================================================')
  console.log('\nBefore running e2e tests, please re-read the development test guide:')
  console.log(`  ${docsPath}`)
  console.log('\nThe guide documents required dev-container, network and BASE_URL setup.')
  console.log("If you're running these tests in CI or have already reviewed the guide, set the environment variable: CONFIRM_DEV_SETUP=true")
  console.log('Otherwise, you will be prompted to confirm you have read the guide and prepared your environment.')
  console.log('\n')
}

async function promptUser() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question('Type YES to confirm you have read docs/dev-setup.md and prepared your environment: ', (answer) => {
      rl.close()
      resolve(answer && answer.trim() === 'YES')
    })
  })
}

async function main() {
  printReminder()

  if (process.env.CI === 'true' || process.env.CONFIRM_DEV_SETUP === 'true' || process.env.SKIP_DEVSETUP_CHECK === 'true') {
    console.log('Pre-run check bypassed via environment variable (CI/CONFIRM_DEV_SETUP/SKIP_DEVSETUP_CHECK)')
    process.exit(0)
  }

  if (!process.stdin.isTTY) {
    console.error('Non-interactive shell detected and CONFIRM_DEV_SETUP is not set. Aborting to avoid accidental e2e runs. Set CONFIRM_DEV_SETUP=true to proceed in non-interactive environments.')
    process.exit(2)
  }

  const ok = await promptUser()
  if (!ok) {
    console.error("Confirmation failed — aborting e2e run. Re-run after reading docs/dev-setup.md and typing 'YES'.")
    process.exit(1)
  }
  console.log('Confirmed. Proceeding with e2e run.')
  process.exit(0)
}

main()
