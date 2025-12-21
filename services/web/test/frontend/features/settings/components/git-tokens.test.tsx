import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import GitTokensPanel from '../../../../../frontend/js/features/settings/components/GitTokensPanel'

afterEach(() => {
  if (typeof fetchMock.restore === 'function') fetchMock.restore()
  else if (typeof fetchMock.reset === 'function') fetchMock.reset()
})

it('creates a token and shows the returned plaintext once', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [])
  render(<GitTokensPanel userId={userId} />)

  expect(screen.queryByText(/No tokens yet/i)).to.not.be.null

  // Mock create token response
  fetchMock.post(`/internal/api/users/${userId}/git-tokens`, { id: 't1', token: 'plaintext-token', accessTokenPartial: 'abc' })
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [{ id: 't1', label: 'lbl', hashPrefix: 'abc', scopes: [], createdAt: '2025-01-01' }])

  fireEvent.change(screen.getByLabelText(/Label/i), { target: { value: 'lbl' } })
  fireEvent.click(screen.getByText(/Create Token/i))

  await waitFor(() => expect(screen.queryByText(/Copy this token now/i)).to.not.be.null)
  expect(screen.queryByText('plaintext-token')).to.not.be.null
})

it('copies created token to clipboard when Copy clicked', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [])
  render(<GitTokensPanel userId={userId} />)

  // Mock create token response
  fetchMock.post(`/internal/api/users/${userId}/git-tokens`, { id: 't1', token: 'plaintext-token', accessTokenPartial: 'abc' })
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [{ id: 't1', label: 'lbl', hashPrefix: 'abc', scopes: [], createdAt: '2025-01-01' }])

  fireEvent.change(screen.getByLabelText(/Label/i), { target: { value: 'lbl' } })
  fireEvent.click(screen.getByText(/Create Token/i))

  await waitFor(() => expect(screen.queryByText(/Copy this token now/i)).to.not.be.null)

  const writes: string[] = []
  ;(navigator as any).clipboard = { writeText: (s: string) => { writes.push(s); return Promise.resolve() } }

  fireEvent.click(screen.getByText('Copy'))

  await waitFor(() => expect(writes).to.contain('plaintext-token'))
  expect(screen.queryByText('Copied')).to.not.be.null
})

it('adds accessible labels for copy and close buttons', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [])
  render(<GitTokensPanel userId={userId} />)

  fetchMock.post(`/internal/api/users/${userId}/git-tokens`, { id: 't1', token: 'plaintext-token', accessTokenPartial: 'abc' })
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [{ id: 't1', label: 'lbl', hashPrefix: 'abc', scopes: [], createdAt: '2025-01-01' }])

  fireEvent.change(screen.getByLabelText(/Label/i), { target: { value: 'lbl' } })
  fireEvent.click(screen.getByText(/Create Token/i))

  await waitFor(() => expect(screen.queryByText(/Copy this token now/i)).to.not.be.null)

  expect(screen.getByLabelText('Copy token to clipboard')).to.not.be.null
  expect(screen.getByLabelText('Close token preview')).to.not.be.null
})

it('treats 404 on token list as empty list (no tokens yet)', async () => {
  const userId = 'u1'
  // Simulate backend returning 404 for the list (some dev envs proxy issue)
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, 404)
  render(<GitTokensPanel userId={userId} />)

  await waitFor(() => expect(screen.queryByText(/No tokens yet/i)).to.not.be.null)
  expect(screen.queryByText(/Something went wrong/i)).to.be.null
})