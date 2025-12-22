import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const controllerPath = '../../services/web/app/src/Features/LLMChat/LLMChatController.mjs'

describe('LLMChatController', () => {
  let controller
  beforeEach(async () => {
    // Clear environment
    delete process.env.LLM_AVAILABLE_MODELS
    delete process.env.LLM_API_URL
    delete process.env.LLM_API_KEY
    delete process.env.LLM_MODEL_NAME
    // Mock User module to avoid Mongoose dependency at import time
    vi.mock('../../services/web/app/src/models/User.js', () => ({
      User: {
        findById: vi.fn().mockResolvedValue(null),
      },
    }))
    // Ensure SessionManager is available (we added a shim), but spy on its method on-demand in tests
    // Clear module cache and re-import fresh
    controller = await import(controllerPath)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getModels returns server models when env set', async () => {
    process.env.LLM_AVAILABLE_MODELS = 'm1,m2'
    const req = { session: {}, params: { Project_id: 'p1' } }
    const res = { json: vi.fn() }

    await controller.default.getModels(req, res)

    expect(res.json).toHaveBeenCalled()
    const arg = res.json.mock.calls[0][0]
    expect(Array.isArray(arg.models)).toBe(true)
    expect(arg.models.map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('getModels includes personal model when user configured', async () => {
    // Mock SessionManager to simulate logged-in user
    const SessionManager = await import('../../services/web/app/src/Features/Authentication/SessionManager.mjs')
    vi.spyOn(SessionManager.default, 'getLoggedInUserId').mockImplementation(() => 'user1')

    // Mock User.findById to return personal settings
    const UserMod = await import('../../services/web/app/src/models/User.js')
    const mockUser = { useOwnLLMSettings: true, llmModelName: 'umodel', llmApiUrl: 'https://x', llmApiKey: 'k' }
    UserMod.User.findById = vi.fn().mockResolvedValue(mockUser)

    const req = { session: {}, params: { Project_id: 'p1' } }
    const res = { json: vi.fn() }

    await controller.default.getModels(req, res)

    expect(res.json).toHaveBeenCalled()
    const arg = res.json.mock.calls[0][0]
    expect(arg.models.some(m => m.isPersonal && m.id.includes('personal'))).toBe(true)
  })

  it('chat returns 503 when global LLM not configured', async () => {
    // Ensure no env set and no user personal model
    const req = { body: { messages: [{ role: 'user', content: 'hi' }] }, params: { Project_id: 'p1' }, session: {} }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }

    await controller.default.chat(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    const arg = res.json.mock.calls[0][0]
    expect(arg.error).toMatch(/LLM service is not configured/)
  })

})
