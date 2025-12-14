import { describe, it, beforeEach, expect, vi } from 'vitest'

// Use focused bootstrap
import '../vitest_bootstrap.mjs'

// Stub out underlying model and inject into controller
function FakeUserSSHKey(doc = {}) {
  Object.assign(this, doc)
  this.save = async () => { this._id = this._id || 'created-id'; return this }
}
FakeUserSSHKey.find = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => [] }) })
FakeUserSSHKey.findOne = vi.fn().mockReturnValue({ lean: () => ({ exec: async () => null }) })
FakeUserSSHKey.findOneAndDelete = vi.fn().mockResolvedValue(null)


describe('UserSSHKeysController (focused)', () => {
  let Controller
  beforeEach(async () => {
    // Mock AdminAuthorizationHelper to allow admin access
    vi.doMock('../../../services/web/app/src/Features/Helpers/AdminAuthorizationHelper.mjs', () => ({ default: { hasAdminAccess: vi.fn().mockReturnValue(true) } }))
    const mod = await import('../../../services/web/app/src/Features/User/UserSSHKeysController.mjs')
    if (mod.__setUserSSHKeyForTest) {
      mod.__setUserSSHKeyForTest(FakeUserSSHKey)
    }
    // mock User model used for enriching metadata
    vi.doMock('../../../services/web/app/src/models/User.js', () => ({ User: { findById: vi.fn().mockResolvedValue({ email: 'a@b', first_name: 'A', last_name: 'B' }) } }))
    Controller = mod.default
  })

  it('can call create', async () => {
    const req = { params: { userId: 'u' }, body: { key_name: 'k', public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCu' }, session: {} }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    await Controller.create(req, res, () => {})
    expect(FakeUserSSHKey.prototype.save).toBeUndefined()
    expect(res.status).toHaveBeenCalled()
  })

  it('can list keys', async () => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis(), sendStatus: vi.fn() }
    await Controller.list({ params: { userId: 'u' } }, res, () => {})
    expect(res.json).toHaveBeenCalled()
  })

  it('can remove keys', async () => {
    const req = { params: { userId: 'u', keyId: 'the-key' }, session: {} }
    const res = { sendStatus: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
    await Controller.remove(req, res, () => {})
    expect(FakeUserSSHKey.findOneAndDelete).toHaveBeenCalled()
  })
})
