// @vitest-environment jsdom
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock fetch to return project list
const sampleProjects = [
  { id: 'p1', name: 'Alpha', owner: { email: 'owner1@example.com', firstName: 'Owner', lastName: 'One' } },
  { id: 'p2', name: 'Beta', owner: { email: 'owner2@example.com', firstName: 'Owner', lastName: 'Two' } }
]

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(sampleProjects) }))
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('ProjectList component', () => {
  it('fetches and renders projects and supports search', async () => {
    const comp = await import('../../modules/admin-project-list/frontend/js/components/project-list.jsx')
    const ProjectList = comp.default
    render(React.createElement(ProjectList))

    // Wait for project names to appear
    const a = await screen.findByText('Alpha')
    const b = await screen.findByText('Beta')
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()

    // Use search to filter
    const input = screen.getByPlaceholderText(/Search by project name/)
    fireEvent.change(input, { target: { value: 'Alpha' } })
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.queryByText('Beta')).toBeNull()
  })
})
