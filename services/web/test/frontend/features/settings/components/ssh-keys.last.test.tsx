import { expect } from 'chai'
describe('last', function () {
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
});
})
