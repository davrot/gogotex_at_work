const noopCache = {
  get (key) { return undefined },
  set (key, value, ttlSeconds) { /* no-op */ },
  invalidate (key) { /* no-op */ }
}

export default noopCache
