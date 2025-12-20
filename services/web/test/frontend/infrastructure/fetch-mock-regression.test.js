import { expect } from 'chai'
import fetchMock from 'fetch-mock'

describe('fetch-mock global spy configuration (regression)', function () {
  beforeEach(function () {
    // ensure clean slate
    if (typeof fetchMock.removeRoutes === 'function') fetchMock.removeRoutes()
    if (typeof fetchMock.reset === 'function') fetchMock.reset()
  })

  afterEach(function () {
    if (typeof fetchMock.removeRoutes === 'function') fetchMock.removeRoutes()
    if (typeof fetchMock.reset === 'function') fetchMock.reset()
  })

  it('keeps config.fetch pointing to the native fetch (avoids recursion)', async function () {
    const nativeFetch = global.fetch
    // Reconfigure fetch-mock defensively like bootstrap does
    if (nativeFetch) fetchMock.config.fetch = nativeFetch
    fetchMock.spyGlobal()

    // config.fetch must not be the spy wrapper (which is stored at global.fetch now)
    expect(fetchMock.config.fetch).to.equal(nativeFetch)
    // set up simple mocked route
    fetchMock.once('/__regression_test__', { status: 200, body: 'ok' })

    const res = await fetch('/__regression_test__')
    const text = await res.text()
    expect(text).to.equal('ok')

    // cleanup
    if (typeof fetchMock.removeRoutes === 'function') fetchMock.removeRoutes()
    if (typeof fetchMock.reset === 'function') fetchMock.reset()
  })
})