import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import GitTokensPanel from '@/features/settings/components/GitTokensPanel'

afterEach(() => {
  fetchMock.restore()
})

test('creates a token and shows the returned plaintext once', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [])
  render(<GitTokensPanel userId={userId} />)

  expect(screen.getByText(/No tokens yet/i)).toBeInTheDocument()

  // Mock create token response
  fetchMock.post(`/internal/api/users/${userId}/git-tokens`, { id: 't1', token: 'plaintext-token', accessTokenPartial: 'abc' })
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [{ id: 't1', label: 'lbl', hashPrefix: 'abc', scopes: [], createdAt: '2025-01-01' }])

  fireEvent.change(screen.getByLabelText(/Label/i), { target: { value: 'lbl' } })
  fireEvent.click(screen.getByText(/Create Token/i))

  await waitFor(() => expect(screen.getByText(/Copy this token now/i)).toBeInTheDocument())
  expect(screen.getByText('plaintext-token')).toBeInTheDocument()
})
