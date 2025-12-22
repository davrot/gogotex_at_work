// Minimal SessionManager shim for mod tests and local usage
export default {
  getLoggedInUserId(session) {
    if (!session) return null
    return session.userId || null
  },
}
