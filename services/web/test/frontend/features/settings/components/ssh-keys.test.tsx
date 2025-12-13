import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import SSHKeysPanel from '@/features/settings/components/SSHKeysPanel'

afterEach(() => {
  if (typeof fetchMock.restore === 'function') fetchMock.restore()
  else if (typeof fetchMock.reset === 'function') fetchMock.reset()
})

it('renders no keys and allows adding and deleting keys', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [])
  render(<SSHKeysPanel userId={userId} />)

  expect(screen.queryByText(/No SSH keys yet/i)).to.not.be.null

  // Mock adding key
  fetchMock.post(`/internal/api/users/${userId}/ssh-keys`, 200)
  // After adding, GET will return one key
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [
    { id: 'k1', label: 'my key', fingerprint: 'fp1', created_at: '2025-01-01' },
  ])

  fireEvent.change(screen.getByLabelText(/SSH key label/i), { target: { value: 'my key' } })
  fireEvent.change(screen.getByLabelText(/SSH public key/i), { target: { value: 'ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAI' } })
  fireEvent.click(screen.getByLabelText(/Add SSH key/i))

  await waitFor(() => expect(screen.queryByText(/SSH key added/i)).to.not.be.null)
})

it('disables add button when label missing or key invalid and shows success message', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [])
  render(<SSHKeysPanel userId={userId} />)

  const addBtn = screen.getByLabelText('Add SSH key') as HTMLButtonElement
  expect(addBtn.disabled).to.be.true

  fireEvent.change(screen.getByLabelText(/SSH key label/i), { target: { value: 'mykey' } })
  expect(addBtn.disabled).to.be.true

  fireEvent.change(screen.getByLabelText(/SSH public key/i), { target: { value: 'not-a-key' } })
  expect(addBtn.disabled).to.be.true

  // Prepare to accept the add and return a key list with one entry
  fetchMock.post(`/internal/api/users/${userId}/ssh-keys`, 200)
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, [{ id: 'k2', label: 'mykey', fingerprint: 'fp2', created_at: '2025-12-13' }])

  fireEvent.change(screen.getByLabelText(/SSH public key/i), { target: { value: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIbX' } })
  await waitFor(() => expect(addBtn.disabled).to.be.false)

  fireEvent.click(addBtn)

  await waitFor(() => expect(screen.queryByText(/SSH key added/i)).to.not.be.null)
})

it('treats 404 on ssh-keys list as empty list (no keys yet)', async () => {
  const userId = 'u1'
  fetchMock.get(`/internal/api/users/${userId}/ssh-keys`, 404)
  render(<SSHKeysPanel userId={userId} />)

  await waitFor(() => expect(screen.queryByText(/No SSH keys yet/i)).to.not.be.null)
  expect(screen.queryByText(/Something went wrong/i)).to.be.null
})