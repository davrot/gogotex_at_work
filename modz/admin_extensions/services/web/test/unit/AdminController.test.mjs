import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'

// Mock emitToAll
const emitMock = vi.fn()
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/Features/Editor/EditorRealTimeController.mjs', () => ({ emitToAll: emitMock }))

// Mock TpdsProjectFlusher
const flushMock = vi.fn((id, cb) => cb(null))
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher.mjs', () => ({ flushProjectToTpds: flushMock }))

// Mock TpdsUpdateSender
const pollMock = vi.fn((id, cb) => cb())
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.mjs', () => ({ pollDropboxForUser: pollMock }))

// Mock SystemMessageManager
const createMessageMock = vi.fn((content, cb) => cb(null))
const clearMessagesMock = vi.fn(cb => cb(null))
vi.mock('/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/app/src/Features/SystemMessages/SystemMessageManager.mjs', () => ({ createMessage: createMessageMock, clearMessages: clearMessagesMock }))

beforeEach(() => {
  // attach spies to stubs via global hooks used by the stubs
  globalThis.__emitToAllSpy = emitMock
  globalThis.__flushProjectToTpds = flushMock
  globalThis.__pollDropboxForUser = pollMock
  globalThis.__createMessageMock = createMessageMock
  globalThis.__clearMessagesMock = clearMessagesMock

  emitMock.mockClear()
  flushMock.mockClear()
  pollMock.mockClear()
  createMessageMock.mockClear()
  clearMessagesMock.mockClear()
})

afterEach(() => {
  delete globalThis.__emitToAllSpy
  delete globalThis.__flushProjectToTpds
  delete globalThis.__pollDropboxForUser
  delete globalThis.__createMessageMock
  delete globalThis.__clearMessagesMock
})

describe('AdminController (modz)', () => {
  it('_sendDisconnectAllUsersMessage calls emitToAll with delay', () => {
    // import after mocks set
    return import('../../app/src/Features/ServerAdmin/AdminController.mjs').then(({ default: AdminController }) => {
      AdminController._sendDisconnectAllUsersMessage(7)
      expect(emitMock).toHaveBeenCalledWith('forceDisconnect', expect.any(String), 7)
    })
  })

  it('disconnectAllUsers redirects and emits', () => {
    return import('../../app/src/Features/ServerAdmin/AdminController.mjs').then(({ default: AdminController }) => {
      const req = { query: { delay: '3' } }
      const res = { redirect: vi.fn() }
      AdminController.disconnectAllUsers(req, res)
      expect(emitMock).toHaveBeenCalled()
      expect(res.redirect).toHaveBeenCalledWith('/admin#open-close-editor')
    })
  })

  it('flushProjectToTpds responds 200 on success', () => {
    return import('../../app/src/Features/ServerAdmin/AdminController.mjs').then(({ default: AdminController }) => {
      const req = { body: { project_id: 'p1' } }
      const res = { sendStatus: vi.fn() }
      const next = vi.fn()
      AdminController.flushProjectToTpds(req, res, next)
      expect(flushMock).toHaveBeenCalledWith('p1', expect.any(Function))
      expect(res.sendStatus).toHaveBeenCalledWith(200)
    })
  })

  it('createMessage redirects on success', () => {
    return import('../../app/src/Features/ServerAdmin/AdminController.mjs').then(({ default: AdminController }) => {
      const req = { body: { content: 'hello' } }
      const res = { redirect: vi.fn() }
      const next = vi.fn()
      AdminController.createMessage(req, res, next)
      expect(createMessageMock).toHaveBeenCalledWith('hello', expect.any(Function))
      expect(res.redirect).toHaveBeenCalledWith('/admin#system-messages')
    })
  })

  it('clearMessages redirects on success', () => {
    return import('../../app/src/Features/ServerAdmin/AdminController.mjs').then(({ default: AdminController }) => {
      const res = { redirect: vi.fn() }
      const next = vi.fn()
      AdminController.clearMessages({}, res, next)
      expect(clearMessagesMock).toHaveBeenCalled()
      expect(res.redirect).toHaveBeenCalledWith('/admin#system-messages')
    })
  })
})
