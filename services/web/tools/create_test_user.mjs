#!/usr/bin/env node
import mongoose from 'mongoose'
import process from 'node:process'

const USAGE = `Usage: node tools/create_test_user.mjs <email>`
if (process.argv.length < 3) {
  console.error(USAGE)
  process.exit(2)
}
const email = process.argv[2]
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/sharelatex'

async function run() {
  try {
    await mongoose.connect(mongoUri, { dbName: 'sharelatex' })
    const Users = new mongoose.Schema({ email: String, emails: Array, first_name: String, hashedPassword: String, signUpDate: Date, isAdmin: Boolean })
    const Model = mongoose.model('User', Users, 'users')

    const found = await Model.findOne({ email }).lean().exec()
    if (found) {
      console.log(found._id.toString())
      process.exit(0)
    }

    const doc = {
      email,
      emails: [{ email, confirmedAt: new Date() }],
      first_name: email.split('@')[0],
      signUpDate: new Date(),
      isAdmin: false,
    }
    const res = await Model.create(doc)
    console.log(res._id.toString())
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Failed to create/find user:', err && (err.stack || err.message || err))
    try { await mongoose.disconnect() } catch (_) {}
    process.exit(1)
  }
}

run()
