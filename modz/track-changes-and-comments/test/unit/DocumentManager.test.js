const { describe, it, expect, vi, beforeEach } = require('vitest')
const path = require('node:path')

const DM_PATH = path.resolve(__dirname, '../../services/document-updater/app/js/DocumentManager.js')
const REDIS_PATH = path.resolve(__dirname, '../../services/document-updater/app/js/RedisManager.js')
const PERSIST_PATH = path.resolve(__dirname, '../../services/document-updater/app/js/PersistenceManager.js')

describe('DocumentManager.getDoc', () => {
  beforeEach(() => {
    // Reset modules
    delete require.cache[require.resolve(DM_PATH)]
    delete require.cache[require.resolve(REDIS_PATH)]
    delete require.cache[require.resolve(PERSIST_PATH)]
  })

  it('falls back to persistence when redis misses and stores in redis', async () => {
    const RedisManager = require(REDIS_PATH)
    const PersistenceManager = require(PERSIST_PATH)

    RedisManager.promises = {
      getDoc: vi.fn().mockResolvedValue({ lines: null, version: null }),
      putDocInMemory: vi.fn().mockResolvedValue(true),
    }
    PersistenceManager.promises = {
      getDoc: vi.fn().mockResolvedValue({
        lines: ['a','b'],
        version: 5,
        ranges: {},
        resolvedCommentIds: [],
        pathname: 'doc.tex',
        projectHistoryId: 'ph1',
        historyRangesSupport: false,
      }),
    }

    const DocumentManager = require(DM_PATH)

    const result = await DocumentManager.getDoc('proj', 'doc1')

    expect(result.lines).toEqual(['a','b'])
    expect(result.version).toBe(5)
    expect(RedisManager.promises.putDocInMemory).toHaveBeenCalled()
  })
})
