import importOverleafModules from '../../../macros/import-overleaf-module.macro'
import {
  JSXElementConstructor,
  useCallback,
  useState,
  type UIEvent,
} from 'react'

const [contactUsModalModules] = importOverleafModules('contactUsModal')
const ContactUsModal: JSXElementConstructor<{
  show: boolean
  handleHide: () => void
  autofillProjectUrl: boolean
}> = contactUsModalModules?.import.default ||
  // Test/development fallback: provide a minimal ContactUs modal so tests can
  // assert that clicking the Help button opens a dialog without requiring the
  // optional macro module to be present.
  (process.env.NODE_ENV !== 'production'
    ? ({ show, handleHide }: { show: boolean; handleHide: () => void }) =>
        show ? (
          <div role="dialog">
            <h2>Get in touch</h2>
            <label>Subject</label>
            <button onClick={handleHide}>Close</button>
          </div>
        ) : null
    : undefined)

export const useContactUsModal = (options = { autofillProjectUrl: true }) => {
  const [show, setShow] = useState(false)

  const hideModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(false)
  }, [])

  const showModal = useCallback((event?: Event | UIEvent) => {
    event?.preventDefault()
    setShow(true)
  }, [])

  const modal = ContactUsModal && (
    <ContactUsModal
      show={show}
      handleHide={hideModal}
      autofillProjectUrl={options.autofillProjectUrl}
    />
  )

  return { modal, hideModal, showModal }
}
