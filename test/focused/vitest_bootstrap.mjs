import { vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import Path from 'node:path'

// Point Settings to a test config that contains a minimal mongo object
process.env.OVERLEAF_CONFIG = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), 'config', 'settings.focused.js')

// Lightweight mocks to prevent infra connections in focused tests
vi.mock('ioredis', () => {
  class MockRedis { constructor(){} on(){} once(){} quit(){return Promise.resolve()} disconnect(){return Promise.resolve()} }
  return { default: MockRedis, Redis: MockRedis }
})

// Mock mongoose.connect to avoid network calls
import mongoose from 'mongoose'
if (!mongoose.connect.__vitestMocked) {
  vi.spyOn(mongoose, 'connect').mockImplementation(async function () {
    if (!mongoose.connection) mongoose.connection = { on: () => {}, once: () => {}, client: {} }
    return mongoose
  })
  vi.spyOn(mongoose, 'disconnect').mockResolvedValue()
  mongoose.connect.__vitestMocked = true
}
