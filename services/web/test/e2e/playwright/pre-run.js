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

  const recommended = 'http://develop-webpack-1:3808'
  const baseUrl = process.env.BASE_URL

  function baseUrlOk(url) {
    if (!url) return false
    const u = url.toLowerCase()
    // Only allow develop-* hostnames or docker network IPs; block localhost/127.* because they do not work inside the dev container network
    if (u.includes('develop-') || u.includes('develop_web') || u.includes('develop-webpack')) return true
    // allow typical docker network private IPs (172.x.x.x, 10.x.x.x, 192.168.x.x)
    if (/https?:\/\/(172\.|10\.|192\.168\.)/.test(u)) return true
    return false
  }

  if (!baseUrlOk(baseUrl)) {
    console.error('\nERROR: BASE_URL does not look correct or is not set.')
    console.error(`Found BASE_URL=${baseUrl || '<undefined>'}. Recommended: ${recommended}`)
    console.error("If you're sure your BASE_URL is correct, set CONFIRM_BASE_URL=true to bypass this check.")
    if (process.env.CI === 'true' || process.env.CONFIRM_BASE_URL === 'true' || process.env.CONFIRM_DEV_SETUP === 'true' || process.env.SKIP_DEVSETUP_CHECK === 'true') {
      console.log('BASE_URL check bypassed via environment variables (CI/CONFIRM_BASE_URL/CONFIRM_DEV_SETUP/SKIP_DEVSETUP_CHECK)')
    } else {
      if (!process.stdin.isTTY) {
        console.error('Non-interactive shell detected and BASE_URL is not confirmed. Aborting to avoid accidental e2e runs.')
        process.exit(2)
      }
      const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => rl.question('Type ALLOW to proceed with the current BASE_URL, or press ENTER to abort: ', a => { rl.close(); resolve(a && a.trim() === 'ALLOW') }))
      if (!answer) {
        console.error('BASE_URL not confirmed — aborting e2e run. Set BASE_URL appropriately and re-run (or use CONFIRM_BASE_URL=true to bypass).')
        process.exit(1)
      }
      console.log('BASE_URL confirmed. Proceeding.')
    }
  } else {
    console.log(`BASE_URL looks OK: ${baseUrl}`)
  }

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
