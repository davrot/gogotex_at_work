export default {
  flushProjectToTpds(projectId, cb) {
    const spy = globalThis.__flushProjectToTpds
    if (spy) return spy(projectId, cb)
    process.nextTick(() => cb(null))
  }
}
