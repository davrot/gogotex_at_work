import { chai, vi } from 'vitest'
import './common_bootstrap.js'
import sinon from 'sinon'
import logger from '@overleaf/logger'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import SandboxedModule from 'sandboxed-module'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

SandboxedModule.configure({
  ignoreMissing: true,
  requires: {
    // This is already imported the same way in the mocha bootstrap
    // eslint-disable-next-line import/no-extraneous-dependencies
    sshpk: require('sshpk'),
  },
  globals: {
    AbortController,
    AbortSignal,
    Buffer,
    Promise,
    console,
    process,
    URL,
    TextEncoder,
    TextDecoder,
  },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

// Prevent real Redis connections during unit tests by mocking ioredis
vi.mock('ioredis', () => {
  class MockRedis {
    constructor() {
      this.connected = false
      this.status = 'mock'
    }
    on() {}
    once() {}
    quit() { return Promise.resolve() }
    disconnect() { return Promise.resolve() }
    publish() { return Promise.resolve(0) }
    subscribe() { return Promise.resolve() }
    xadd() { return Promise.resolve() }
    xread() { return Promise.resolve() }
    silentEmit() {}
  }
  return { default: MockRedis, Redis: MockRedis }
})

// Prevent Mongoose from attempting a real MongoDB connection in unit tests
import mongoose from 'mongoose'
if (!mongoose.connect.__vitestMocked) {
  vi.spyOn(mongoose, 'connect').mockImplementation(async function () {
    // Ensure a minimal connection object exists for modules that read it
    if (!mongoose.connection) {
      mongoose.connection = { on: () => {}, once: () => {}, client: {} }
    }
    return mongoose
  })
  vi.spyOn(mongoose, 'disconnect').mockResolvedValue()
  mongoose.connect.__vitestMocked = true
}

/*
 * Chai configuration
 */

// add chai.should()
chai.should()

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(sinonChai)

// Load promise support for chai
chai.use(chaiAsPromised)

// Do not truncate assertion errors
chai.config.truncateThreshold = 0
vi.mock('@overleaf/logger', async () => {
  return {
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      err: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    },
  }
})

beforeEach(ctx => {
  // This function is a utility to duplicate the behaviour of passing `done` in place of `next` in an express route handler.
  ctx.rejectOnError = reject => {
    return err => {
      if (err) {
        reject(err)
      }
    }
  }
  ctx.logger = logger
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  sinon.restore()
})
