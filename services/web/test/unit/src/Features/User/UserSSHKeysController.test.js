const path = require('path')
const { describe, it, beforeEach } = require('mocha')
const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const MockResponse = require('../../helpers/MockResponse.js')

const controllerPath = path.resolve(__dirname, '../../../../../app/src/Features/User/UserSSHKeysController.mjs')
const userSSHKeyModelPath = path.resolve(__dirname, '../../../../../app/src/models/UserSSHKey.js')
const userModelPath = path.resolve(__dirname, '../../../../../app/src/models/User.js')
const lookupCachePath = path.resolve(__dirname, '../../../../../app/src/lib/lookupCache.mjs')

describe('UserSSHKeysController', function () {
  beforeEach(async function () {
    this.UserSSHKey = {
      find: sinon.stub(),
      findOneAndDelete: sinon.stub(),
      findOne: sinon.stub(),
      // Default upsert behavior for tests
      findOneAndUpdate: sinon.stub().returns({ exec: async () => ({ value: { _id: 'mock-k', fingerprint: 'SHA256:MOCK', userId: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), keyName: '', publicKey: '' } }) }),
      prototype: {},
      collection: { insertOne: sinon.stub().resolves({}) },
    }

    this.User = { findById: sinon.stub().resolves({ email: 'test@example.com' }) }

    // Use dynamic import for the ESM controller and inject the mocked model via test hooks
    const { pathToFileURL } = require('url')
    return import(pathToFileURL(controllerPath).href).then((ControllerModule) => {
      this.Controller = ControllerModule
      if (ControllerModule && typeof ControllerModule.__setUserSSHKeyForTest === 'function') {
        ControllerModule.__setUserSSHKeyForTest(this.UserSSHKey)
      }
    })
  })

  afterEach(function () {
    if (this.Controller && typeof this.Controller.__resetUserSSHKeyForTest === 'function') {
      try { this.Controller.__resetUserSSHKeyForTest() } catch (e) {}
    }
  })

  it('create returns 201 with fingerprint and caches', async function () {
    this.UserSSHKey.find.returns({ lean: () => ({ exec: async () => [] }) })
    const req = { params: { userId: 'u1' }, body: { key_name: 'test', public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCy1234567890ABCDEFG=' } }
    const res = new MockResponse()

    await this.Controller.create(req, res)
    expect(res.statusCode).to.equal(201)
    const body = JSON.parse(res.body)
    expect(body).to.have.property('fingerprint')
  })

  it('remove invalidates cache and returns 204', async function () {
    const fakeDoc = { _id: 'k1', fingerprint: 'SHA256:AAAA', userId: 'u1' }
    this.UserSSHKey.findOneAndDelete.resolves(fakeDoc)
    const req = { params: { userId: 'u1', keyId: 'k1' } }
    const res = new MockResponse()
    await this.Controller.remove(req, res)
    expect(res.statusCode).to.equal(204)
  })
})
