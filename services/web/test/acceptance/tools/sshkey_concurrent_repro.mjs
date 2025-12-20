#!/usr/bin/env node
import UserHelper from '../src/helpers/UserHelper.mjs'

async function run() {
  console.log('Starting sshkey concurrency repro')
  const user = await UserHelper.createUser()
  const userId = user.id || user._id || (user.user && user.user._id) || user._id
  console.log('Created test user id=', userId)

  // Construct a deterministic public key
  const payloadData = Buffer.from('overleaf-concurrency-stress-constant').toString('base64')
  const publicKey = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ${payloadData}`

  const requests = Number(process.argv[2] || 20)
  console.log(`Issuing ${requests} concurrent POST /user/${userId}/ssh-keys`)

  const body = JSON.stringify({ key_name: 'stress', public_key: publicKey })

  const promises = []
  for (let i = 0; i < requests; i++) {
    promises.push(user.fetch(`/user/${userId}/ssh-keys`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body }))
  }

  const settled = await Promise.allSettled(promises)
  const counts = { ok201: 0, ok200: 0, conflict409: 0, other: 0 }
  for (const p of settled) {
    if (p.status === 'fulfilled') {
      const resp = p.value
      if (resp.status === 201) counts.ok201++
      else if (resp.status === 200) counts.ok200++
      else if (resp.status === 409) counts.conflict409++
      else counts.other++
    } else {
      counts.other++
    }
  }

  console.log('Response counts:', counts)

  // Query final list
  const listResp = await user.fetch(`/user/${userId}/ssh-keys`)
  const listBody = await listResp.json()
  console.log('Final list count:', Array.isArray(listBody) ? listBody.length : 'N/A')
  console.log('Final list:', listBody)

  if (Array.isArray(listBody) && listBody.length === 1) {
    console.log('SUCCESS: single canonical key present')
    process.exit(0)
  }
  console.error('FAILURE: expected single canonical key')
  process.exit(1)
}

run().catch(e => { console.error('Error in repro', e && (e.stack || e)); process.exit(2) })