import Ajv from 'ajv'
import fs from 'fs'
import { expect } from 'chai'

const ajv = new Ajv({ allErrors: true })

describe('Auth log schema validation', function () {
  it('should validate sample token.introspect log against schema', function () {
    const schema = JSON.parse(fs.readFileSync('./services/web/lib/log-schemas/auth-events.json'))
    const validate = ajv.compile(schema)

    const sample = {
      event: 'token.introspect',
      service: 'web',
      level: 'info',
      userId: 'u-42',
      resourceType: 'personal_access_token',
      resourceId: 'abc12345',
      action: 'introspect',
      outcome: 'success',
      timestamp: new Date().toISOString(),
    }

    expect(validate(sample), 'Validation errors: ' + JSON.stringify(validate.errors)).to.equal(true)
  })
})
