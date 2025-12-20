#!/usr/bin/env node
import mongoose from 'mongoose'
import Settings from '@overleaf/settings'
import { UserSSHKey } from '../services/web/app/src/models/UserSSHKey.js'

const MONGO_HOST = process.env.MONGO_HOST || 'mongo'
const MONGO_PORT = process.env.MONGO_PORT || '27017'
const DB = process.env.MONGO_DB || 'overleaf'

const URI = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${DB}`

async function run() {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 })
  console.log('connected to mongo')
  const agg = await UserSSHKey.aggregate([
    { $group: { _id: '$fingerprint', count: { $sum: 1 }, docs: { $push: { id: '$_id', userId: '$userId', createdAt: '$createdAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ])
  console.log('duplicates:', JSON.stringify(agg, null, 2))
  await mongoose.disconnect()
}

run().catch(e=>{ console.error('err', e && e.stack); process.exit(2) })