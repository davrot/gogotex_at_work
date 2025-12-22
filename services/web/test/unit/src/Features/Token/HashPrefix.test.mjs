import { expect } from 'chai'
import { computeHashPrefix } from '../../../../../app/src/Features/Token/hashPrefixUtil.mjs'

describe('hashPrefix derivation', function () {
  it('computes prefix from raw bytes', function () {
    const raw = Buffer.from('0102030405060708090a0b0c0d0e0f10', 'hex')
    const prefix = computeHashPrefix({ rawBytes: raw })
    expect(prefix).to.equal('01020304')
  })

  it('computes prefix from argon2 modular encoding', function () {
    // synthetic digest bytes and base64
    const digest = Buffer.from('deadbeefcafebabe000102030405060708090a0b0c0d0e0f101112131415161718', 'hex')
    const digestB64 = digest.toString('base64')
    const modular = `$argon2id$v=19$m=65536,t=2,p=1$SALTbase64$${digestB64}`.replace('SALTbase64', 'c2FsdA==')
    const prefix = computeHashPrefix({ algorithm: 'argon2id', modular })
    // expected first 8 hex of digest
    expect(prefix).to.equal(digest.toString('hex').slice(0, 8))
  })

  it('computes prefix from provided digestB64', function () {
    const digest = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
    const b64 = digest.toString('base64')
    const prefix = computeHashPrefix({ digestB64: b64 })
    expect(prefix).to.equal('00112233')
  })

  it('computes prefix from digestHex', function () {
    const prefix = computeHashPrefix({ digestHex: 'abcDEF0123456789' })
    expect(prefix).to.equal('abcdef01')
  })
})
