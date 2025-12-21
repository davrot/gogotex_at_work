export default {
  Request: class Request { constructor(req) { this.req = req } },
  Response: class Response { constructor(res) { this.res = res } },
  server: { authenticate: async () => { throw new Error('Oauth2Server.authenticate not mocked') } }
}
