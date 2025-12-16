const assert = require('assert')
const redis = require('../../../index')

describe('createClient defaults', function () {
  it('defaults lazyConnect to true and overrides 127.0.0.1 host to redis when REDIS_HOST unset', function () {
    delete process.env.REDIS_HOST
    const client = redis.createClient({ host: '127.0.0.1', port: 6379 })
    assert.strictEqual(client.options.lazyConnect, true)
    assert.strictEqual(client.options.host, 'redis')
  })
})
