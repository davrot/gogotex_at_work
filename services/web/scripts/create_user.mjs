#!/usr/bin/env node
import Settings from '@overleaf/settings'
import { db as defaultDb } from '../app/src/infrastructure/mongodb.js'
import UserRegistrationHandler from '../app/src/Features/User/UserRegistrationHandler.mjs'

async function main() {
  const [,, email, password] = process.argv
  if (!email) {
    console.error('Usage: create_user.mjs <email> [password]')
    process.exit(1)
  }
  const pwd = password || 'Test1234!'
  try {
    console.log('Creating user', email)
    const user = await UserRegistrationHandler.promises.registerNewUser({ email, password: pwd })
    console.log('Created user:', user)
    process.exit(0)
  } catch (err) {
    console.error('Error creating user:', err.message || err)
    process.exit(2)
  }
}

main()
