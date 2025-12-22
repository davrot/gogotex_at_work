export default {
  createMessage(content, cb) {
    const spy = globalThis.__createMessageMock
    if (spy) return spy(content, cb)
    process.nextTick(() => cb(null))
  },
  clearMessages(cb) {
    const spy = globalThis.__clearMessagesMock
    if (spy) return spy(cb)
    process.nextTick(() => cb(null))
  },
  getMessagesFromDB(cb) {
    const spy = globalThis.__getMessagesFromDB
    if (spy) return spy(cb)
    process.nextTick(() => cb(null, []))
  }
}

export const createMessage = (content, cb) => {
  const spy = globalThis.__createMessageMock
  if (spy) return spy(content, cb)
  process.nextTick(() => cb(null))
}
export const clearMessages = cb => {
  const spy = globalThis.__clearMessagesMock
  if (spy) return spy(cb)
  process.nextTick(() => cb(null))
}
export const getMessagesFromDB = cb => {
  const spy = globalThis.__getMessagesFromDB
  if (spy) return spy(cb)
  process.nextTick(() => cb(null, []))
}
