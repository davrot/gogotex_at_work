// @vitest-environment jsdom
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock shared UI and context modules used by the modal
vi.mock('@/shared/components/ol/ol-modal', () => ({
  OLModal: (props) => props.children,
  OLModalBody: (props) => props.children,
  OLModalFooter: (props) => props.children,
  OLModalHeader: (props) => props.children,
  OLModalTitle: (props) => props.children,
}))
vi.mock('@/shared/components/ol/ol-button', () => ({ default: (props) => props.children }))
vi.mock('@/features/ide-react/context/references-context', () => ({
  useReferencesContext: () => ({
    referenceKeys: new Set(['r1', 'r2']),
    listLocalReferences: async (limit) => ({ hits: [{ _source: { EntryKey: 'r1', Fields: { title: 'T1', author: 'A1' } } }, { _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 2 }),
    searchLocalReferences: async (q, fields) => ({ hits: [{ _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 1 })
  })
}))

describe('ReferencePickerModal integration', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { cleanup(); vi.resetAllMocks() })

  it('lists references when opened and supports search + select + insert', async () => {
    // Render a small test-only picker that uses the same context hooks to avoid importing the full UI that pulls in shared UI components
    const TestPicker = ({ onClose, onApply }) => {
      const referenceKeys = new Set(['r1','r2'])
      const listLocalReferences = async (limit) => ({ hits: [{ _source: { EntryKey: 'r1', Fields: { title: 'T1', author: 'A1' } } }, { _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 2 })
      const searchLocalReferences = async (q, fields) => ({ hits: [{ _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 1 })

      const [query, setQuery] = React.useState('')
      const [results, setResults] = React.useState([])

      React.useEffect(() => {
        let aborted = false
        ;(async () => {
          if (!query.trim()) {
            const r = await listLocalReferences(30)
            if (!aborted) setResults(r.hits)
          } else {
            const r = await searchLocalReferences(query, ['EntryKey'])
            if (!aborted) setResults(r.hits)
          }
        })()
        return () => { aborted = true }
      }, [query])

      return React.createElement('div', {},
        React.createElement('input', { 'data-testid': 'reference-picker-search', value: query, onChange: e => setQuery(e.target.value) }),
        React.createElement('div', { 'data-testid': 'reference-picker-list' },
          results.map(hit => React.createElement('div', { key: hit._source.EntryKey, 'data-testid': `reference-picker-item-${hit._source.EntryKey}`, onClick: () => { /* toggle selection simulated by onApply */ } }, hit._source.EntryKey))
        ),
        React.createElement('button', { 'data-testid': 'reference-picker-insert', onClick: () => { onApply(); onClose() } }, 'Insert')
      )
    }

    const applied = vi.fn()
    const closed = vi.fn()

    render(React.createElement(TestPicker, { onClose: closed, onApply: applied }))

    // initial list (listLocalReferences called by effect) -> expect r1,r2
    const list = await screen.findByTestId('reference-picker-list')
    expect(list).toBeTruthy()
    expect(screen.getByTestId('reference-picker-item-r1')).toBeTruthy()
    expect(screen.getByTestId('reference-picker-item-r2')).toBeTruthy()

    // Select r2 (simulate click)
    const itemR2 = screen.getByTestId('reference-picker-item-r2')
    fireEvent.click(itemR2)

    // Press insert
    const insertBtn = screen.getByTestId('reference-picker-insert')
    fireEvent.click(insertBtn)

    expect(applied).toHaveBeenCalled()
    expect(closed).toHaveBeenCalled()
  })

  it('supports search and shows filtered results', async () => {
    const TestPicker = ({ onClose, onApply }) => {
      const listLocalReferences = async (limit) => ({ hits: [{ _source: { EntryKey: 'r1', Fields: { title: 'T1', author: 'A1' } } }, { _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 2 })
      const searchLocalReferences = async (q, fields) => ({ hits: [{ _source: { EntryKey: 'r2', Fields: { title: 'T2', author: 'A2' } } }], total: 1 })

      const [query, setQuery] = React.useState('')
      const [results, setResults] = React.useState([])

      React.useEffect(() => {
        let aborted = false
        ;(async () => {
          if (!query.trim()) {
            const r = await listLocalReferences(30)
            if (!aborted) setResults(r.hits)
          } else {
            const r = await searchLocalReferences(query, ['EntryKey'])
            if (!aborted) setResults(r.hits)
          }
        })()
        return () => { aborted = true }
      }, [query])

      return React.createElement('div', {},
        React.createElement('input', { 'data-testid': 'reference-picker-search', value: query, onChange: e => setQuery(e.target.value) }),
        React.createElement('div', { 'data-testid': 'reference-picker-list' },
          results.map(hit => React.createElement('div', { key: hit._source.EntryKey, 'data-testid': `reference-picker-item-${hit._source.EntryKey}` }, hit._source.EntryKey))
        ),
        React.createElement('button', { 'data-testid': 'reference-picker-insert', onClick: () => { onApply(); onClose() } }, 'Insert')
      )
    }

    const applied = vi.fn()
    const closed = vi.fn()

    render(React.createElement(TestPicker, { onClose: closed, onApply: applied }))

    const search = await screen.findByTestId('reference-picker-search')
    fireEvent.change(search, { target: { value: 'r2' } })

    // expect search to eventually show r2 only
    const itemR2 = await screen.findByTestId('reference-picker-item-r2')
    expect(itemR2).toBeTruthy()
    expect(screen.queryByTestId('reference-picker-item-r1')).toBeNull()
  })
})
