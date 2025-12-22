export default {
  emitToAll(event, message, delay) {
    const spy = globalThis.__emitToAllSpy
    if (spy) return spy(event, message, delay)
  }
}

export const emitToAll = (event, message, delay) => {
  const spy = globalThis.__emitToAllSpy
  if (spy) return spy(event, message, delay)
}
