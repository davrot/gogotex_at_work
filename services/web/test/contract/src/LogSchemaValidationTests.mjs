import Ajv from 'ajv'
import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'url'
import { expect } from 'chai'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))
const ajv = new Ajv({ allErrors: true })
import addFormats from 'ajv-formats'
addFormats(ajv)

describe('Auth log schema validation', function () {
  it('should validate sample token.introspect log against schema', function () {
    let schemaPath = Path.resolve(__dirname, '../../lib/log-schemas/auth-events.json')
    // Debug: print resolved path and existence so failures are easier to diagnose
    // eslint-disable-next-line no-console
    console.debug('[LogSchemaValidationTests] schemaPath:', schemaPath, 'exists:', fs.existsSync(schemaPath))
    if (!fs.existsSync(schemaPath)) {
      // try an alternate location commonly used in this repo
      const alt = Path.resolve(__dirname, '../../..', 'lib/log-schemas/auth-events.json')
      // eslint-disable-next-line no-console
      console.debug('[LogSchemaValidationTests] trying alternate schemaPath:', alt, 'exists:', fs.existsSync(alt))
      if (fs.existsSync(alt)) schemaPath = alt
    }
    const schema = JSON.parse(fs.readFileSync(schemaPath))
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
