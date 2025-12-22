exports.promises = {
  async getDoc(projectId, docId) {
    return { lines: null, version: null }
  },
  async putDocInMemory(projectId, docId, lines, version, ranges, resolvedCommentIds, pathname, projectHistoryId, historyRangesSupport) {
    return true
  },
  async updateDocument() {
    return true
  },
  async removeDocFromMemory() {
    return true
  },
}
