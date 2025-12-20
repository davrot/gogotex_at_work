#!/usr/bin/env node
import mongodb from 'mongodb-legacy'
const { MongoClient } = mongodb
const MONGO_HOST = process.env.MONGO_HOST || 'mongo'
const MONGO_PORT = process.env.MONGO_PORT || '27017'
const DB = process.env.MONGO_DB || 'overleaf'
const URI = `mongodb://${MONGO_HOST}:${MONGO_PORT}`

async function run() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 })
  await client.connect()
  const db = client.db(DB)
  const coll = db.collection('usersshkeys')
  const pipeline = [
    { $match: { fingerprint: { $exists: true } } },
    { $group: { _id: '$fingerprint', count: { $sum: 1 }, docs: { $push: { id: '$_id', userId: '$userId', createdAt: '$createdAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ]
  const groups = await coll.aggregate(pipeline).toArray()
  console.log('duplicate fingerprint groups:', groups.length)
  for (const g of groups) {
    console.log('fingerprint', g._id, 'count', g.count)
    for (const d of (g.docs || [])) console.log('  doc', d.id, d.userId, d.createdAt)
  }
  await client.close()
}
run().catch(e => { console.error(e && e.stack || e); process.exit(2) })