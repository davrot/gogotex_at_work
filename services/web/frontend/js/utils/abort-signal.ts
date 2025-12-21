import './abortsignal-polyfill'

export const signalWithTimeout = (signal: AbortSignal, timeout: number) => {
  // Prefer native AbortSignal.any when available, but fall back to a robust
  // implementation to avoid cross-realm issues in the test environment.
  try {
    if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    }
  } catch (err) {
    // ignore and fall back
  }

  const controller = new AbortController()

  // If the incoming signal aborts, abort our controller
  const onAbort = (ev?: Event) => controller.abort((ev as any)?.target?.reason)
  signal.addEventListener('abort', onAbort)

  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout)

  // cleanup when controller aborts
  controller.signal.addEventListener('abort', () => {
    signal.removeEventListener('abort', onAbort)
    clearTimeout(timer)
  })

  return controller.signal
}
