import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import SSHKeysPanel from '@/features/settings/components/SSHKeysPanel'

afterEach(() => {
  fetchMock.restore()
})

test('renders no keys and allows adding and deleting keys', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [])
  render(<SSHKeysPanel userId={userId} />)

  expect(screen.getByText(/No SSH keys yet/i)).toBeInTheDocument()

  // Mock adding key
  fetchMock.post(`/internal/api/users/${userId}/ssh-keys`, 200)
  // After adding, GET will return one key
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [
    { id: 'k1', label: 'my key', fingerprint: 'fp1', created_at: '2025-01-01' },
  ])

  fireEvent.change(screen.getByLabelText(/Label/i), { target: { value: 'my key' } })
  fireEvent.change(screen.getByLabelText(/Public Key/i), { target: { value: 'ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAI' } })
  fireEvent.click(screen.getByText(/Add SSH key/i))

  await waitFor(() => expect(screen.getByText('my key')).toBeInTheDocument())
  expect(screen.getByText('fp1')).toBeInTheDocument()

  // Mock delete
  fetchMock.delete(`/internal/api/users/${userId}/ssh-keys/k1`, 200)
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [])

  fireEvent.click(screen.getByText(/Delete/i))

  await waitFor(() => expect(screen.getByText(/No SSH keys yet/i)).toBeInTheDocument())
})
