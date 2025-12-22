export default {
  pollDropboxForUser(userId, cb) {
    const spy = globalThis.__pollDropboxForUser
    if (spy) return spy(userId, cb)
    process.nextTick(cb)
  }
}
