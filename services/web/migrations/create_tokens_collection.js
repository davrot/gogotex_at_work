#!/usr/bin/env node
// Simple migration to ensure tokens collection and indexes exist.
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'overleaf_test';
  const coll = process.env.MONGO_TOKENS_COLL || 'tokens';
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection(coll);
  console.log('Ensuring index on hash for', coll);
  await collection.createIndex({ hash: 1 }, { unique: true, background: true });
  console.log('Done.');
  await client.close();
}

main().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});