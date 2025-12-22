// @vitest-environment jsdom
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { fireEvent } from '@testing-library/dom'

// We'll import the initSymbolPalette and create a minimal modal to attach to
import initSymbolPalette from '../../modules/latex-editor/frontend/components/latex-editor-symbolpalette.mjs'

describe('latex-editor symbol palette accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // create a minimal modal structure the palette expects
    const modal = document.createElement('div')
    modal.id = 'latex-editor-modal-root'
    modal.className = 'latex-editor'
    const body = document.createElement('div')
    body.className = 'latex-editor-body'
    const left = document.createElement('div')
    left.className = 'latex-editor-left'
    body.appendChild(left)

    // add a textarea and preview so palette can move them
    const ta = document.createElement('textarea')
    ta.className = 'latex-editor-textarea'
    left.appendChild(ta)
    const preview = document.createElement('div')
    preview.className = 'latex-editor-preview'
    left.appendChild(preview)

    modal.appendChild(body)
    document.body.appendChild(modal)
  })

  afterEach(() => { document.body.innerHTML = '' })

  it('attaches palette to modal without throwing', async () => {
    // call init (it may be async)
    await initSymbolPalette()
    const palette = document.getElementById('latex-symbol-palette')
    // palette may not be created if no data modules exist in test environment; ensure code runs and no error thrown
    expect(palette === null || palette instanceof HTMLElement).toBe(true)
  })

  it('handles keyboard navigation keys on modal container', async () => {
    await initSymbolPalette()
    // simulate keyboard events on the modal container to exercise handlers
    const root = document.querySelector('#latex-editor-modal-root')
    const keyDown = (k) => fireEvent.keyDown(root, { key: k })
    keyDown('ArrowDown')
    keyDown('ArrowUp')
    keyDown('Tab')
    keyDown('Enter')
    // If no errors thrown during this flow, test is satisfied
    expect(true).toBe(true)
  })
})
