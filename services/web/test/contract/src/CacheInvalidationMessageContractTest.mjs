import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Very small contract test to assert schema presence and basic shape

describe('Cache invalidation message schema', () => {
  it('loads the schema and has required fields', async () => {
    const schemaPath = path.resolve(process.cwd(), 'specs/auth-cache-invalidate.v1.json')
    const raw = await fs.promises.readFile(schemaPath, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed).to.have.property('required')
    expect(parsed.required).to.include('version')
    expect(parsed.required).to.include('type')
  })
})
