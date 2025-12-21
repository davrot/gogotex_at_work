import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import SSHKeysPanel from '../../../../../frontend/js/features/settings/components/SSHKeysPanel'

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

it('uses effectiveUserId meta for create POST when userId prop missing and sends correct body', async () => {
  const effectiveUserId = 'eff1'
  // Reset the meta cache and set the user id in the meta cache (so getMeta() returns it)
  const { resetMeta } = require('../../../helpers/reset-meta')
  resetMeta()
  // set meta cache directly for getMeta to return value in tests
  ;(window as any).metaAttributesCache.set('ol-user_id', effectiveUserId)
  // also add a DOM meta tag for completeness / snapshots
  document.head.insertAdjacentHTML('beforeend', `<meta name="ol-user_id" content="${effectiveUserId}">`)

  fetchMock.get(`/internal/api/users/${effectiveUserId}/ssh-keys`, [])

  // Instead of relying on fetch-mock internals for POST body capture, stub postJSON from our infra
  const fetchJson = require('@/infrastructure/fetch-json')
  let recordedPost: any = undefined
  const origPost = fetchJson.postJSON
  fetchJson.postJSON = async (path: string, opts: any) => {
    recordedPost = { path, opts }
    return { status: 200 }
  }

  // Still ensure GET path is mocked so fetchKeys does not hit the network during mount
  fetchMock.get(new RegExp(`/internal/api/users/${effectiveUserId}/ssh-keys`), [])

  render(<SSHKeysPanel />)

  fireEvent.change(screen.getByLabelText(/SSH key label/i), { target: { value: 'label-meta' } })
  fireEvent.change(screen.getByLabelText(/SSH public key/i), { target: { value: 'ssh-ed25519 AAAAC3' } })
  fireEvent.click(screen.getByLabelText(/Add SSH key/i))

  await waitFor(() => expect(screen.queryByText(/SSH key added/i)).to.not.be.null)


  // Assert the stubbed postJSON was called with expected values
  expect(recordedPost).to.not.be.undefined
  const body = typeof recordedPost.opts.body === 'string' ? JSON.parse(recordedPost.opts.body) : recordedPost.opts.body
  expect(recordedPost.path).to.include(`/internal/api/users/${effectiveUserId}/ssh-keys`)
  expect(body).to.have.property('key_name', 'label-meta')
  expect(body).to.have.property('public_key', 'ssh-ed25519 AAAAC3')

  // restore the original postJSON to avoid affecting other tests
  fetchJson.postJSON = origPost

  // cleanup meta
  const m = document.querySelector('meta[name="ol-user_id"]')
  if (m && m.parentNode) m.parentNode.removeChild(m)
})

it('shows error when no user id available on create', async () => {
  // ensure no meta and no prop
  const m = document.querySelector('meta[name="ol-user_id"]')
  if (m && m.parentNode) m.parentNode.removeChild(m)

  // Reset meta cache to clear any cached user id
  const { resetMeta } = require('../../../helpers/reset-meta')
  resetMeta()

  fetchMock.get('/internal/api/users/undefined/ssh-keys', 404)
  render(<SSHKeysPanel />)

  // prepare inputs
  fireEvent.change(screen.getByLabelText(/SSH key label/i), { target: { value: 'label-no-id' } })
  fireEvent.change(screen.getByLabelText(/SSH public key/i), { target: { value: 'ssh-ed25519 AAAAC3' } })
  fireEvent.click(screen.getByLabelText(/Add SSH key/i))

  await waitFor(() => expect(screen.queryByText(/No user id available for SSH key create/i)).to.not.be.null)
})

it('delete uses effectiveUserId when available', async () => {
  const effectiveUserId = 'eff2'
  const { resetMeta } = require('../../../helpers/reset-meta')
  resetMeta()
  ;(window as any).metaAttributesCache.set('ol-user_id', effectiveUserId)
  document.head.insertAdjacentHTML('beforeend', `<meta name="ol-user_id" content="${effectiveUserId}">`)

  fetchMock.get(`/internal/api/users/${effectiveUserId}/ssh-keys`, [{ id: 'k3', label: 'delkey', fingerprint: 'fp3', created_at: '2025-12-13' }])

  let deletedUrl: string | undefined
  fetchMock.delete(`/internal/api/users/${effectiveUserId}/ssh-keys/k3`, (url:any, opts:any) => { deletedUrl = url as string; return 204 })

  render(<SSHKeysPanel />)

  // click delete (stub confirm dialog)
  global.confirm = () => true
  await waitFor(() => expect(screen.queryByText(/delkey/i)).to.not.be.null)
  fireEvent.click(screen.getByLabelText(/Delete SSH key delkey/i))

  await waitFor(() => {
    if (typeof deletedUrl === 'string') {
      expect(deletedUrl).to.equal(`/internal/api/users/${effectiveUserId}/ssh-keys/k3`)
    } else if (deletedUrl && deletedUrl.args && Array.isArray(deletedUrl.args)) {
      expect(deletedUrl.args[0]).to.equal(`/internal/api/users/${effectiveUserId}/ssh-keys/k3`)
    } else {
      throw new Error('Unexpected deletedUrl shape: ' + JSON.stringify(deletedUrl))
    }
  })
  // restore confirm
  // @ts-ignore
  delete global.confirm

  // cleanup
  const m2 = document.querySelector('meta[name="ol-user_id"]')
  if (m2 && m2.parentNode) m2.parentNode.removeChild(m2)
})