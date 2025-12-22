exports.promises = {
  async getDoc(projectId, docId) {
    return {
      lines: ['a','b'],
      version: 5,
      ranges: {},
      resolvedCommentIds: [],
      pathname: 'doc.tex',
      projectHistoryId: 'ph1',
      historyRangesSupport: false,
    }
  },
  async setDoc() { return true },
}
