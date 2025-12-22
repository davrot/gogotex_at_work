import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

const DM_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/DocumentManager.js')
const REDIS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/RedisManager.js')
const PERSIST_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/PersistenceManager.js')

describe('DocumentManager.getDoc', () => {
  beforeEach(() => {
    // no-op: we set mocks directly in each test
  })

  it('falls back to persistence when redis misses and stores in redis', async () => {
    const RedisManager = await import(REDIS_PATH)
    const PersistenceManager = await import(PERSIST_PATH)

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

    const DocumentManager = await import(DM_PATH)

    const result = await DocumentManager.getDoc('proj', 'doc1')

    expect(result.lines).toEqual(['a','b'])
    expect(result.version).toBe(5)
    expect(RedisManager.promises.putDocInMemory).toHaveBeenCalled()
  })
})
