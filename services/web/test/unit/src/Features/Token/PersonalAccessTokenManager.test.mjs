import { expect } from 'chai'

let PersonalAccessTokenManager

describe('PersonalAccessTokenManager', function () {
  let origEnv
  beforeEach(function () {
    origEnv = process.env.AUTH_TOKEN_USE_WEBPROFILE_API
    // Tests in this file assume local DB behavior; opt out of delegation explicitly
    process.env.AUTH_TOKEN_USE_WEBPROFILE_API = 'false'
  })
  beforeEach(async function () {
    // Import after env manipulation so module picks up AUTH_TOKEN_USE_WEBPROFILE_API
    const PAMod = await import('../../../../../app/src/Features/Token/PersonalAccessTokenManager.mjs')
    PersonalAccessTokenManager = PAMod.default || PAMod
  })
  afterEach(function () {
    if (origEnv === undefined) delete process.env.AUTH_TOKEN_USE_WEBPROFILE_API
    else process.env.AUTH_TOKEN_USE_WEBPROFILE_API = origEnv
  })

  describe('listTokens', function () {
    it('returns an empty list for an invalid userId', async function () {
      const res = await PersonalAccessTokenManager.listTokens('u1')
      expect(res).to.be.an('array').that.is.empty
    })

    it('returns tokens when given a valid ObjectId userId', async function () {
      // Use createRequire to import CommonJS model and mongoose
      const { createRequire } = await import('module')
      const requireC = createRequire(import.meta.url)
      const { PersonalAccessToken } = requireC('../../../../../app/src/models/PersonalAccessToken')
      const mongoose = requireC('mongoose')

      const objectId = '6941855c285892382016da33'
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(objectId),
        label: 'l1',
        scopes: [],
        active: true,
        hashPrefix: 'abcd',
        createdAt: new Date(),
        expiresAt: null,
      }

      const sinon = (await import('sinon')).default
      const stub = sinon.stub(PersonalAccessToken, 'find').returns({ sort: () => ({ lean: () => Promise.resolve([fakeDoc]) }) })
      try {
        const res = await PersonalAccessTokenManager.listTokens(objectId)
        expect(res).to.be.an('array').with.length(1)
        expect(res[0]).to.include({ label: 'l1', active: true, hashPrefix: 'abcd' })
        expect(res[0].id).to.equal(objectId)
      } finally {
        stub.restore()
      }
    })
  })

  describe('introspect', function () {
    it('returns active:false when token not found', async function () {
      const { createRequire } = await import('module')
      const requireC = createRequire(import.meta.url)
      const { PersonalAccessToken } = requireC('../../../../../app/src/models/PersonalAccessToken')
      const sinon = (await import('sinon')).default
      const stub = sinon.stub(PersonalAccessToken, 'find').returns({ lean: () => Promise.resolve([]) })
      try {
        const res = await PersonalAccessTokenManager.introspect('no-such-token')
        expect(res).to.be.an('object')
        expect(res.active).to.equal(false)
      } finally {
        stub.restore()
      }
    })

    it('returns active:true when token matches stored hash (pbkdf2 case)', async function () {
      const { createRequire } = await import('module')
      const requireC = createRequire(import.meta.url)
      const { PersonalAccessToken } = requireC('../../../../../app/src/models/PersonalAccessToken')
      const mongoose = requireC('mongoose')
      const crypto = requireC('crypto')
      const sinon = (await import('sinon')).default

      const tokenPlain = 'my-token-123'
      // Create pbkdf2 style stored hash used by fallback in manager
      const salt = crypto.randomBytes(16)
      const derived = crypto.pbkdf2Sync(tokenPlain, salt, 100000, 64, 'sha256')
      const storedHash = `pbkdf2$${salt.toString('hex')}$${derived.toString('hex')}`
      // Compute prefix
      const digest = crypto.createHash('sha256').update(tokenPlain).digest('hex')
      const prefix = digest.slice(0, 8)

      const userId = new mongoose.Types.ObjectId()
      const candidate = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        hash: storedHash,
        hashPrefix: prefix,
        scopes: [],
        active: true,
        expiresAt: null,
      }

      const stub = sinon.stub(PersonalAccessToken, 'find').returns({ lean: () => Promise.resolve([candidate]) })
      try {
        const res = await PersonalAccessTokenManager.introspect(tokenPlain)
        expect(res).to.be.an('object')
        expect(res.active).to.equal(true)
        expect(res.hashPrefix).to.equal(prefix)
        expect(res.userId).to.equal(userId.toString())
      } finally {
        stub.restore()
      }
    })
  })

  describe('createToken', function () {
    it('saves to db and returns expected shape', async function () {
      const { createRequire } = await import('module')
      const requireC = createRequire(import.meta.url)
      const { PersonalAccessToken } = requireC('../../../../../app/src/models/PersonalAccessToken')
      const mongoose = requireC('mongoose')
      const sinon = (await import('sinon')).default

      const userId = new mongoose.Types.ObjectId().toString()
      const fakeId = new mongoose.Types.ObjectId('6941855c285892382016da33')
      const expires = new Date(Date.now() + 1000 * 60 * 60)

      const saveStub = sinon.stub(PersonalAccessToken.prototype, 'save').callsFake(async function () {
        this._id = fakeId
        this.hashPrefix = 'cafebabe'
        this.createdAt = new Date()
        this.expiresAt = expires
        return this
      })

      try {
        const origAlgo = process.env.AUTH_TOKEN_HASH_ALGO
        process.env.AUTH_TOKEN_HASH_ALGO = 'pbkdf2'
        const res = await PersonalAccessTokenManager.createToken(userId, { label: 'tlabel', scopes: ['a'], expiresAt: expires })
        expect(res).to.be.an('object')
        expect(res).to.have.property('token').that.is.a('string')
        expect(res.id).to.equal(fakeId.toString())
        expect(res.hashPrefix).to.equal('cafebabe')
        expect(res.expiresAt).to.eql(expires)
        expect(saveStub.calledOnce).to.equal(true)
        process.env.AUTH_TOKEN_HASH_ALGO = origAlgo
      } finally {
        saveStub.restore()
      }
    })
  })
})
