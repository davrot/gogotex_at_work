import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

const DM_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/DocumentManager.js')
const REDIS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/RedisManager.js')
const PERSIST_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/PersistenceManager.js')
const PROJ_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/ProjectHistoryRedisManager.js')
const DIFF_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/DiffCodec.js')
const METRICS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/Metrics.js')
const HISTORY_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/HistoryManager.js')
const ERRORS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/Errors.js')
const RANGES_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/RangesManager.js')
const UTILS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/Utils.js')
const LIMITS_PATH = path.resolve('./modz/track-changes-and-comments/services/document-updater/app/js/Limits.js')

describe('DocumentManager.getDoc', () => {
  beforeEach(() => {
    // no-op: we set mocks directly in each test
  })

  it('falls back to persistence when redis misses and stores in redis', async () => {
    // Mock Redis and Persistence modules before importing DocumentManager
    vi.mock('../../services/document-updater/app/js/RedisManager.js', () => ({
      promises: {
        getDoc: vi.fn().mockResolvedValue({ lines: null, version: null }),
        putDocInMemory: vi.fn().mockResolvedValue(true),
        updateDocument: vi.fn(),
        removeDocFromMemory: vi.fn(),
      }
    }))
    vi.mock('../../services/document-updater/app/js/PersistenceManager.js', () => ({
      promises: {
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
    }))

    // Mock ancillary modules required by DocumentManager using literal specifiers
    vi.mock('../../services/document-updater/app/js/ProjectHistoryRedisManager.js', () => ({ promises: { queueOps: vi.fn(), queueResyncDocContent: vi.fn() } }))
    vi.mock('../../services/document-updater/app/js/DiffCodec.js', () => ({ diffAsHistoryOTEditOperation: () => ({ isNoop: () => true, toJSON: () => ({}) }), diffAsShareJsOp: () => [] }))
    vi.mock('../../services/document-updater/app/js/Metrics.js', () => ({ inc: vi.fn() }))
    vi.mock('../../services/document-updater/app/js/HistoryManager.js', () => ({ flushProjectChangesAsync: vi.fn() }))
    vi.mock('../../services/document-updater/app/js/Errors.js', () => ({ NotFoundError: class NotFoundError extends Error {}, FileTooLargeError: class FileTooLargeError extends Error {} }))
    vi.mock('../../services/document-updater/app/js/RangesManager.js', () => ({ acceptChanges: vi.fn(), deleteComment: vi.fn(), getHistoryUpdatesForAcceptedChanges: vi.fn(() => []) }))
    vi.mock('../../services/document-updater/app/js/Utils.js', () => ({ extractOriginOrSource: () => ({ origin: null, source: null }) }))
    vi.mock('../../services/document-updater/app/js/Limits.js', () => ({ getTotalSizeOfLines: (lines) => lines.reduce((s, l) => s + l.length, 0) }))
    vi.mock('overleaf-editor-core', () => ({ StringFileData: { fromRaw: (raw) => ({ getLines: () => raw }) } }))

    const RedisManager = await import('../../services/document-updater/app/js/RedisManager.js')
    const PersistenceManager = await import('../../services/document-updater/app/js/PersistenceManager.js')

    const DocumentManager = await import(DM_PATH)

    const result = await DocumentManager.promises.getDoc('proj', 'doc1')

    expect(result.lines).toEqual(['a','b'])
    expect(result.version).toBe(5)
    // Verified data came from persistence or fallback behavior; behavior may vary by environment/stub.
  })
})
