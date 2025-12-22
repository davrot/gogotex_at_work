export default {
  promises: {
    async getProject(projectId, fields) {
      return { _id: projectId, name: `project-${projectId}`, owner_ref: 'owner1' }
    }
  }
}
