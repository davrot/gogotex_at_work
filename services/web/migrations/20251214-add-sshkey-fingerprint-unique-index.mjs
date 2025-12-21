import mongoose from 'mongoose'
import Settings from '../config/settings.js'

export async function up() {
  const uri = Settings.mongo && Settings.mongo.url
  if (!uri) throw new Error('mongo.url not configured in Settings')
  await mongoose.connect(uri, { dbName: Settings.mongo.db || undefined })
  const db = mongoose.connection
  try {
    const coll = db.collection('usersshkeys')
    await coll.createIndex({ fingerprint: 1 }, { unique: true, sparse: true })
    console.log('Created unique index on usersshkeys.fingerprint')
  } finally {
    await mongoose.disconnect()
  }
}

export async function down() {
  const uri = Settings.mongo && Settings.mongo.url
  if (!uri) throw new Error('mongo.url not configured in Settings')
  await mongoose.connect(uri, { dbName: Settings.mongo.db || undefined })
  const db = mongoose.connection
  try {
    const coll = db.collection('usersshkeys')
    await coll.dropIndex('fingerprint_1')
    console.log('Dropped index fingerprint_1 on usersshkeys')
  } finally {
    await mongoose.disconnect()
  }
}
