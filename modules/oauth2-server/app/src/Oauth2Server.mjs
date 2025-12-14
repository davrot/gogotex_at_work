export default {
  Request: class Request {
    constructor(req) { this.req = req }
  },
  Response: class Response {
    constructor(res) { this.res = res }
  },
  server: {
    authenticate: async (request, response, opts) => {
      // Default behavior: throw to indicate tests should mock this
      throw new Error('Oauth2Server.authenticate not mocked')
    }
  }
}
