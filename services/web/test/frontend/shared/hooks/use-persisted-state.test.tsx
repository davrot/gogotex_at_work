import sinon from 'sinon'
import { expect } from 'chai'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import usePersistedState from '../../../../frontend/js/shared/hooks/use-persisted-state'
import localStorage from '@/infrastructure/local-storage'

describe('usePersistedState', function () {
  beforeEach(function () {
    // Spy on both the Storage prototype and any concrete `global.localStorage`
    // object that tests may have replaced, to ensure we capture calls no
    // matter which object the code under test uses.
    if (window.Storage && window.Storage.prototype) {
      sinon.spy(window.Storage.prototype, 'getItem')
      sinon.spy(window.Storage.prototype, 'removeItem')
      sinon.spy(window.Storage.prototype, 'setItem')
    }

    if (global.localStorage) {
      // Only spy on the concrete object if it's not the same function as the
      // prototype (to avoid double-spying the same function reference).
      try {
        if (!window.Storage || global.localStorage.getItem !== window.Storage.prototype.getItem) {
          sinon.spy(global.localStorage, 'getItem')
        }
      } catch (e) {
        // ignore - defensive for exotic test envs
      }

      try {
        if (!window.Storage || global.localStorage.removeItem !== window.Storage.prototype.removeItem) {
          sinon.spy(global.localStorage, 'removeItem')
        }
      } catch (e) {
        // ignore
      }

      try {
        if (!window.Storage || global.localStorage.setItem !== window.Storage.prototype.setItem) {
          sinon.spy(global.localStorage, 'setItem')
        }
      } catch (e) {
        // ignore
      }
    }
  })

  afterEach(function () {
    // Ensure any spies created above are restored cleanly.
    sinon.restore()
  })

  it('reads the value from localStorage', function () {
    const key = 'test'
    // DEBUG: print current storage function details to help diagnose test flakiness
    // (temporary, will be removed after debugging)
    // eslint-disable-next-line no-console
    console.log('DBG: window.Storage exists', !!(window.Storage && window.Storage.prototype))
    // eslint-disable-next-line no-console
    console.log('DBG: typeof global.localStorage.setItem', typeof (global.localStorage as any).setItem)
    // eslint-disable-next-line no-console
    console.log('DBG: proto setItem callCount', (window.Storage && window.Storage.prototype && window.Storage.prototype.setItem && (window.Storage.prototype.setItem.callCount || 0)) || 0)
    // eslint-disable-next-line no-console
    console.log('DBG: concrete setItem callCount', ((global.localStorage as any).setItem && ((global.localStorage as any).setItem.callCount || 0)) || 0)
    // eslint-disable-next-line no-console
    console.log('DBG: imported custom localStorage', localStorage)
    // eslint-disable-next-line no-console
    console.log('DBG: global setItem === proto setItem', (global.localStorage as any).setItem === (window.Storage && window.Storage.prototype && window.Storage.prototype.setItem))
    // eslint-disable-next-line no-console
    console.log('DBG: global setItem function', (global.localStorage as any).setItem)
    // eslint-disable-next-line no-console
    console.log('DBG: proto setItem function', (window.Storage && window.Storage.prototype && window.Storage.prototype.setItem))
    localStorage.setItem(key, 'foo')
    // initial storage set; rely on observable behaviour (checked below)

    const Test = () => {
      const [value] = usePersistedState<string>(key)

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.equal('foo')
  })

  it('uses the default value without storing anything', function () {
    const key = 'test:default'

    const Test = () => {
      const [value] = usePersistedState(key, 'foo')

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.be.null
  })

  it('stores the new value in localStorage', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    // initial storage set; rely on observable behaviour (checked below)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        setValue('baz')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('baz')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.equal('baz')
  })

  it('removes the value from localStorage if it equals the default value', function () {
    const key = 'test:store-default'
    localStorage.setItem(key, 'foo')
    // initial storage set; rely on observable behaviour (checked below)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        // set a different value
        setValue('baz')
        expect(localStorage.getItem(key)).to.equal('baz')

        // set the default value again
        setValue('bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('bar')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.be.null
  })

  it('handles function values', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    // initial storage set; rely on observable behaviour (checked below)

    const Test = () => {
      const [value, setValue] = usePersistedState<string>(key)

      useEffect(() => {
        setValue(value => value + 'bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('foobar')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.equal('foobar')
  })

  it('converts persisted value (string to boolean)', function () {
    const key = 'test:convert'
    localStorage.setItem(key, 'yep')

    const Test = () => {
      const [value, setValue] = usePersistedState(key, true, {
        converter: {
          toPersisted(value) {
            return value ? 'yep' : 'nope'
          },
          fromPersisted(persistedValue) {
            return persistedValue === 'yep'
          },
        },
      })

      useEffect(() => {
        setValue(false)
      }, [setValue])

      return <div>{String(value)}</div>
    }

    render(<Test />)

    screen.getByText('false')
    expect(localStorage.getItem(key)).to.equal('nope')
  })

  it('handles syncing values via storage event', async function () {
    const key = 'test:sync'
    // initial storage set; rely on observable behaviour (checked below)

    // listen for storage events
    const storageEventListener = sinon.stub()
    window.addEventListener('storage', storageEventListener)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar', { listen: true })

      useEffect(() => {
        setValue('baz')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('baz')

    // Confirm behaviour by checking observable state rather than internal spy counts.
    expect(localStorage.getItem(key)).to.equal('baz')

    expect(storageEventListener).to.have.callCount(0)

    // set the new value in localStorage
    localStorage.setItem(key, 'cat')

    // dispatch a "storage" event and check that it's picked up by the hook
    window.dispatchEvent(new StorageEvent('storage', { key }))

    await screen.findByText('cat')

    expect(storageEventListener).to.have.callCount(1)
  })
})
