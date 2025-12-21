import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import GitTokensPanel from '../../../../../frontend/js/features/settings/components/GitTokensPanel'
import { UserProvider } from '../../../../../frontend/js/shared/context/user-context'

afterEach(() => {
  if (typeof fetchMock.restore === 'function') fetchMock.restore()
  else if (typeof fetchMock.reset === 'function') fetchMock.reset()
})

it('lists tokens when user id is provided via UserProvider meta', async () => {
  const userId = 'u1'
  // mock the GET called by the component
  fetchMock.get(`/internal/api/users/${userId}/git-tokens`, [{ id: 't1', label: 'lbl', hashPrefix: 'abc', scopes: [], createdAt: '2025-01-01' }])

  // set the global meta so getMeta('ol-user_id') returns the user id
  window.metaAttributesCache.set('ol-user_id', userId)

  render(<GitTokensPanel />)

  await waitFor(() => expect(screen.queryByText('lbl')).to.not.be.null)
})