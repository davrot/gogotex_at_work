// @vitest-environment jsdom
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import axe from 'axe-core'

// Ensure DOM APIs are present
import React from 'react'

describe('LatexEditorToolbarButton (modz)', () => {
  beforeEach(() => {
    // Clean any modal from previous tests
    const existing = document.getElementById('latex-editor-modal-root')
    if (existing) existing.remove()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with accessible label and role', async () => {
    const Button = (await import('../../modules/latex-editor/frontend/components/latex-editor-toolbar-button.tsx')).default
    render(React.createElement(Button))
    const btn = screen.getByRole('button', { name: 'Equation Editor' })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toBe('Equation Editor')

    // Accessibility: run axe on the document body
    const results = await axe.run(document.body)
    expect(results.violations.length).toBe(0)
  })

  it('clicking button calls modal open when modal exists', async () => {
    const Button = (await import('../../modules/latex-editor/frontend/components/latex-editor-toolbar-button.tsx')).default
    // Create a modal root with API
    const modal = document.createElement('div')
    modal.id = 'latex-editor-modal-root'
    modal.__latexEditor = { open: () => { modal.__opened = true } }
    document.body.appendChild(modal)

    render(React.createElement(Button))
    const btn = screen.getByRole('button', { name: 'Equation Editor' })
    fireEvent.click(btn)

    expect(modal.__opened).toBe(true)
  })
})
