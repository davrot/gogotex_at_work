export default {
  promises: {
    async getUser(id, fields) {
      return { email: 'owner@example.com', first_name: 'Owner', last_name: 'Name' }
    }
  }
}
