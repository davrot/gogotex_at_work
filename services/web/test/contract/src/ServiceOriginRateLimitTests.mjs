import { expect } from 'chai'
import request from '../../acceptance/src/helpers/request.js'

describe('Service-Origin Rate Limits (contract test scaffold)', function () {
  this.timeout(60 * 1000)

  it('should enforce 60 req/min per service-origin for introspection/listing', async function () {
    const SERVICE_ORIGIN = 'contract-test-service-origin'
    const CLIENT = request.defaults({ headers: { 'X-Service-Origin': SERVICE_ORIGIN } })

    const TARGET = '/internal/api/tokens/introspect'

    // perform 60 requests; expect 200s or 200 with active:false
    for (let i = 0; i < 60; i++) {
      const res = await new Promise((resolve, reject) => {
        CLIENT.post({ url: TARGET, json: { token: `bad-${i}` } }, (err, response, body) => {
          if (err) reject(err);
          else resolve(response)
        })
      })
      // We accept 2xx for valid counter; guard against 429 here
      expect(res.statusCode).to.be.oneOf([200, 201, 204, 400])
    }

    // 61st request SHOULD be throttled (429) by service-origin rate-limiter
    const res61 = await new Promise((resolve, reject) => {
      CLIENT.post({ url: TARGET, json: { token: 'bad-last' } }, (err, response, body) => {
        if (err) reject(err);
        else resolve(response)
      })
    })

    // Enforce 429 to make this a concrete contract test; CI should configure the rate limiter accordingly.
    expect(res61.statusCode).to.equal(429)
  })
})
