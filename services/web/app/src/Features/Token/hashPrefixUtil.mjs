import { Buffer } from 'buffer'

function bytesToLowerHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// bcrypt uses a custom base64 alphabet: "./A-Za-z0-9"
const BCRYPT_BASE64_ALPHABET = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const BCRYPT_DECODE_MAP = (() => {
  const m = new Map()
  for (let i = 0; i < BCRYPT_BASE64_ALPHABET.length; i++) m.set(BCRYPT_BASE64_ALPHABET[i], i)
  return m
})()

// Decode bcrypt 31-char hash (from modular string) to raw bytes
export function decodeBcryptHashToBytes(bcryptHash31) {
  // bcrypt encodes 184 bits (23 bytes) into 31 chars via custom base64
  // Implementation adapted to decode groups of 4 chars -> 3 bytes
  const chars = bcryptHash31.split('')
  const bytes = []
  let i = 0
  while (i < chars.length) {
    // read up to 4 chars
    const c0 = BCRYPT_DECODE_MAP.get(chars[i++])
    const c1 = i <= chars.length ? BCRYPT_DECODE_MAP.get(chars[i++]) : 0
    const c2 = i <= chars.length ? BCRYPT_DECODE_MAP.get(chars[i++]) : 0
    const c3 = i <= chars.length ? BCRYPT_DECODE_MAP.get(chars[i++]) : 0
    const v = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    bytes.push((v >> 16) & 0xff)
    bytes.push((v >> 8) & 0xff)
    bytes.push(v & 0xff)
  }
  // bcrypt output may include padding; trim to 23 bytes
  return Uint8Array.from(bytes).slice(0, 23)
}

export function computeHashPrefixFromRawBytes(rawBytes) {
  const hex = bytesToLowerHex(rawBytes)
  return hex.slice(0, 8)
}

export function computeHashPrefixFromArgon2(modularArgon2String) {
  // format: $argon2id$v=19$m=...,t=...,p=...$<salt_b64>$<digest_b64>
  const parts = modularArgon2String.split('$')
  const digestB64 = parts[parts.length - 1]
  const buf = Buffer.from(digestB64, 'base64')
  return computeHashPrefixFromRawBytes(buf)
}

export function computeHashPrefixFromBcrypt(modularBcryptString) {
  // modular: $2b$12$<22char_salt><31char_hash>
  const parts = modularBcryptString.split('$')
  const last = parts[parts.length - 1]
  // last contains salt+hash (22+31=53)
  const hash31 = last.slice(-31)
  const raw = decodeBcryptHashToBytes(hash31)
  return computeHashPrefixFromRawBytes(raw)
}

export function computeHashPrefix({ algorithm, modular, digestB64, rawBytes, digestHex }) {
  if (rawBytes) return computeHashPrefixFromRawBytes(Buffer.from(rawBytes))
  if (digestHex) return digestHex.toLowerCase().slice(0, 8)
  if (algorithm === 'argon2id' && modular) return computeHashPrefixFromArgon2(modular)
  if ((algorithm === 'bcrypt' || algorithm === 'bcrypt-2b') && modular) return computeHashPrefixFromBcrypt(modular)
  if (digestB64) return computeHashPrefixFromRawBytes(Buffer.from(digestB64, 'base64'))
  throw new Error('Unsupported arguments for computeHashPrefix')
}
