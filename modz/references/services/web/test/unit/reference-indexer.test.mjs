import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
// Mock project path aliases used by the module
vi.mock('@/shared/utils/sha1', () => ({ generateSHA1Hash: (s) => s }))
vi.mock('@/utils/debugging', () => ({ debugConsole: { warn: () => {} } }))

// Create a minimal MockWorker to intercept postMessage and allow simulating messages from the worker
class MockWorker {
  constructor(_url, _options) {
    this.listeners = {}
    MockWorker.last = this
  }
  addEventListener(event, handler) {
    this.listeners[event] = handler
  }
  postMessage(msg) {
    this.lastPosted = msg
  }
  simulateMessage(data) {
    const handler = this.listeners['message']
    if (handler) handler({ data })
  }
}

function snapshotWithData({ docs = {}, files = {} } = {}) {
  return {
    getDocPaths: () => Object.keys(docs),
    getDocContents: path => (docs[path] ?? null),
    getBinaryFilePathsWithHash: () => Object.entries(files).map(([path, content]) => ({ path, hash: `${content.length}`, size: content.length })),
    getBinaryFileContents: async path => files[path] ?? null,
  }
}

let oldWorker
beforeEach(() => {
  oldWorker = globalThis.Worker
  globalThis.Worker = MockWorker
})
afterEach(() => {
  globalThis.Worker = oldWorker
  MockWorker.last = null
})

describe('ReferenceIndexer (modz)', () => {
  it('updateFromSnapshot posts an update and resolves when worker replies', async () => {
    const { ReferenceIndexer } = await import('../../frontend/js/features/ide-react/references/reference-indexer')
    const indexer = new ReferenceIndexer()

    const snapshot = snapshotWithData({ docs: { 'refs.bib': '@article{a, title={A}}' } })

    const promise = indexer.updateFromSnapshot(snapshot, { signal: new AbortController().signal })

    // The worker should have received an update message
    expect(MockWorker.last.lastPosted).toBeDefined()
    expect(MockWorker.last.lastPosted.type).toBe('update')

    // Simulate worker response
    MockWorker.last.simulateMessage({ type: 'updateKeys', keys: new Set(['a']) })

    const result = await promise
    expect(result).toEqual(new Set(['a']))
  })

  it('search posts search message and resolves with result', async () => {
    const { ReferenceIndexer } = await import('../../frontend/js/features/ide-react/references/reference-indexer')
    const indexer = new ReferenceIndexer()

    const p = indexer.search('query', ['title'])
    expect(MockWorker.last.lastPosted).toBeDefined()
    expect(MockWorker.last.lastPosted.type).toBe('search')
    expect(MockWorker.last.lastPosted.query).toBe('query')

    MockWorker.last.simulateMessage({ type: 'searchResult', result: { items: [], total: 0 } })
    const res = await p
    expect(res).toHaveProperty('items')
  })

  it('list posts list message and resolves with result', async () => {
    const { ReferenceIndexer } = await import('../../frontend/js/features/ide-react/references/reference-indexer')
    const indexer = new ReferenceIndexer()

    const p = indexer.list(10)
    expect(MockWorker.last.lastPosted.type).toBe('list')
    MockWorker.last.simulateMessage({ type: 'listResult', result: { items: [], total: 0 } })
    const res = await p
    expect(res).toHaveProperty('items')
  })

  it('aborts early and returns empty set', async () => {
    const { ReferenceIndexer } = await import('../../frontend/js/features/ide-react/references/reference-indexer')
    const indexer = new ReferenceIndexer()

    const controller = new AbortController()
    controller.abort()
    const result = await indexer.updateFromSnapshot(snapshotWithData({ files: { 'refs.bib': 'x' } }), { signal: controller.signal })
    expect(result).toEqual(new Set())
  })
})
